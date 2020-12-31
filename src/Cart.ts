/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { LocalFileCartStorage } from './LocalFileCartStorage';
import Storage from './CartStorage';
import { InvalidConfig, DriverNotSupported, OperationFailed } from './exceptions';
import { CartConfig, CartStorageConfig, StorageSingleDriverConfig, CartContent, CartInputItem, CartItem, CartUpdateOption, CartCondition, } from './types';
import { MethodNotSupported } from './exceptions';
import { resolve } from 'path';
import { get, has, isEqual } from 'lodash'

interface StorageConstructor<T extends Storage = Storage> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	new (...args: any[]): T;
}

interface ItemQuantityCost {
  price: number,
  quantity: number
}

export default class Cart {

	/**
	 * Default storage.
	 */
	private defaultStorage: string | undefined;

	/**
	 * Configured storages.
	 */
	private storagesConfig: CartStorageConfig;

	/**
	 * Instantiated storages.
	 */
	private _storages: Map<string, Storage> = new Map();

	/**
	 * List of available drivers.
	 */
	private _drivers: Map<string, StorageConstructor<Storage>> = new Map();

	/**
	 * Current session.
	 */
	private _session: string;

	constructor(session: string, config: CartConfig) {
		this.defaultStorage = config.default;
		this.storagesConfig = config.storages || {};
		this._session = session;
		this.registerDriver('local', LocalFileCartStorage);
	}

	/**
	 * Get cart contents
	 */
	private compute(instance: CartContent): CartContent {
		/**
		 * TODO: compute conditions and items against subtotal,total
		 * NOTE:
		 * Compute sequence is critial.
		 * Ideally: (1) sum items, (2) calculate subtotal +/- conditions, (3) calculate total
		 * Remember CartCondition.order which specifies when it's applied. i.e. conditions of the same target should be sorted by order before being applied
		 * Remember CartCondition.target which applies the condition ammount to the targeted item, subtotal or total
		 * Remember CartCondition.value which (for a value of 10) can take the form `10`,`-10`,`"10"`,`"+10"`,`"-10"`,`"10%"`
		 */

		let initialItemsValues : Map<string, ItemQuantityCost> = new Map();
		let itemsValues : Map<string, ItemQuantityCost> = new Map();
		Array.from(instance.items).forEach(item => {
		initialItemsValues.set(item.id, {price:item.price, quantity:item.quantity});
		itemsValues.set(item.id, {price:item.price, quantity:item.quantity});
		});

		instance.subtotal = Array.from(instance.items).reduce((a, b) => a + b.price * b.quantity, 0);
		instance.total = instance.subtotal;
		let initialSubtotal: number = instance.subtotal;
		let initialTotal: number = instance.total;

		// Sort by items first, then subtotals, then totals.
		// Within each of items, subtotals and totals, sort most importantly by order then, for items only, by target
		instance.conditions = Array.from(instance.conditions).sort((a, b) =>
			(
				(a.target == 'total' && b.target == 'total' && get(a, 'order', 0) < get(b, 'order', 0)) ||
				(a.target != 'total' && b.target == 'total') ||
				(a.target == 'subtotal' && b.target == 'subtotal' && get(a, 'order', 0) < get(b, 'order', 0)) ||
				(a.target != 'subtotal' && a.target != 'total' && b.target == 'subtotal') ||
				(get(a, 'order', 0) < get(b, 'order', 0) && a.target == b.target) ||
				(get(a, 'order', 0) == get(b, 'order', 0) && a.target < b.target)
			) ? -1 : 1
		);

		// Copy conditions so we don't modify instance.conditions and prevent converting strings to numbers
		// e.g. we prevent '10%', a string, a.k.a multiplication of 0.1, getting converted to 0.1, a number, a.k.a addition of 0.1
		let conditions : Array<CartCondition> = [];
		instance.conditions.forEach(condition => {
		conditions.push({
			name: condition.name,
			type: condition.type,
			target: condition.target,
			value: condition.value,
			order: condition.order,
			attributes: condition.attributes
		});
		});
		let updatedSubtotalAfterItems: boolean = false;
		let updatedTotalAfterSubtotals: boolean = false;

		Array.from(conditions).forEach(condition => {
		let multiplyValue : boolean = false;
		if(typeof condition.value == 'string'){
			try {
				[multiplyValue, condition.value] = this.parseStringConditionValue(condition.value);
			} catch(error){
				throw OperationFailed.compute(`Failed to compute after parse error: ${error}`);
			}
		}

		if(condition.target == 'subtotal'){
			// Check subtotal has been recalculated after all item prices updated
			if(!updatedSubtotalAfterItems){
			instance.subtotal = Array.from(itemsValues.values()).reduce((a, b) => a + b.price * b.quantity, 0);
			initialSubtotal = instance.subtotal;
			updatedSubtotalAfterItems = true;
			}

			instance.subtotal = this.updatePrice(initialSubtotal, instance.subtotal, multiplyValue, condition.value);
		} else if(condition.target == 'total'){
			if(!updatedTotalAfterSubtotals){
			// Check total has been reset after subtotal updated
			instance.total = instance.subtotal;
			initialTotal = instance.total;
			updatedTotalAfterSubtotals = true;
			}

			instance.total = this.updatePrice(initialTotal, instance.total, multiplyValue, condition.value);
		} else {
			let itemPrice = itemsValues.get(condition.target);
			let initialItemPrice = initialItemsValues.get(condition.target);
			if(!itemPrice || !initialItemPrice){
			throw OperationFailed.getItem('Item price was not found');
			}
			itemsValues.set(condition.target, {
			price: this.updatePrice(initialItemPrice.price, itemPrice.price, multiplyValue, condition.value),
			quantity: initialItemPrice.quantity
			});
		}
		});

		// At this stage, subtotal has been set temporarily to the value with all vouchers and taxes targeted
		// towards subtotal, in order to determine the total. We set total to this modified subtotal,
		// then recalculate subtotal as the sum of all items
		if(!updatedTotalAfterSubtotals){
		instance.total = instance.subtotal;
		}
		if(updatedSubtotalAfterItems){
		instance.subtotal = Array.from(itemsValues.values()).reduce((a, b) => a + b.price * b.quantity, 0);
		}

		return instance;
  }

	/**
	 * Perform multiply or add operation on price
   * Percentages are calculated based on original price of item, subtotal or total
	 */
  private updatePrice(initialPrice: number, currentPrice: number, multiplyValue: boolean, change: number): number {
    if(multiplyValue){
      return currentPrice + (initialPrice * change);
    }
    return currentPrice + change;
  }

	private parseStringConditionValue(value: string): [boolean, number] {
		try {
			if(value.endsWith('%')){
				value = value.substring(0, value.length - 1); // remove %
				return [true, parseFloat(value) / 100];
			}
			return [false, parseFloat(value)];
		} catch(error){
			throw OperationFailed.parseString(`Invalid condition value: ${value}`);
		}
	}

	/**
	 * Get the instantiated storages
	 */
	public storages(): Map<string, Storage> {
		return this._storages;
	}

	/**
	 * Get the registered drivers
	 */
	drivers(): Map<string, StorageConstructor<Storage>> {
		return this._drivers;
	}

	/**
	 * Set cart session instance
	 * @param session
	 */
	public session(session: string): Cart{
		this._session = session;
		return this
	}

	/**
	 * Set current working driver
	 * @param driver
	 */
	public driver(driver: string): Cart{
		this.storage(driver);
		this.defaultStorage = driver;
		return this
	}

	/**
	 * Get the storage instance
	 */
	public storage<T extends Storage = Storage>(name?: string): T {
		name = name || this.defaultStorage;

		/**
		 * No name is defined and neither there
		 * are any defaults.
		 */
		if (!name) {
			throw InvalidConfig.missingStorageName();
		}

		if (this._storages.has(name)) {
			this._storages.get(name) as T;
		}

		const storageConfig = this.storagesConfig[name];

		/**
		 * Configuration for the defined storage is missing
		 */
		if (!storageConfig) {
			throw InvalidConfig.missingStorageConfig(name);
		}

		/**
		 * There is no driver defined on storage configuration
		 */
		if (!storageConfig.driver) {
			throw InvalidConfig.missingStorageDriver(name);
		}

		const Driver = this._drivers.get(storageConfig.driver);
		if (!Driver) {
			throw DriverNotSupported.driver(storageConfig.driver);
		}

		const storage = new Driver(storageConfig.config);
		this._storages.set(name, storage);

		return storage as T;
	}

	public addStorage(name: string, config: StorageSingleDriverConfig): void {
		if (this.storagesConfig[name]) {
			throw InvalidConfig.duplicateStorageName(name);
		}
		this.storagesConfig[name] = config;
	}

	/**
	 * Register a custom driver.
	 */
	public registerDriver<T extends Storage>(name: string, storage: StorageConstructor<T>): void {
		this._drivers.set(name, storage);
	}

	/**
	 * Add single or multiple items to cart
	 */
	public add<T extends CartInputItem | Array<CartInputItem>>(product: T): Promise<T extends CartInputItem? CartItem : Array<CartItem>>{
		const storage = this.storage()

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();

				let products = (product instanceof Array)? product : [product]
				let items: Array<CartItem> = [];
				let existingItems: Array<CartItem> = [];
				let existingItemOptions: { item_id: number | string, options: CartUpdateOption }[] = [];

				products.forEach(p => {
					// Check if item already exists then increment by quantity or 1,
					//		 checking against `id` and `options`
					let existingItem = instance.items.find(item => (
						p.id == item.id &&
						p.price == item.price &&
						(
							(!p.options?.length) ||
							(item.options!.length && item.options!.length == p.options!.length && isEqual(item.options, p.options))
						)
					))

					let itemQuantity : number = 0;
					let itemPrice : number = 0;

					// Parse and specify default quantity of 1
					if(p.quantity && typeof p.quantity == 'string'){
						itemQuantity = parseInt(p.quantity);
					} else if(p.quantity && typeof p.quantity == 'number'){
						itemQuantity = p.quantity;
					} else {
						itemQuantity = 1;
					}

					// Parse and round to 2 decimal places
					if(p.price && typeof p.price == 'string'){
						itemPrice = Math.round(parseFloat(p.price) * 100) / 100;
					} else if(p.price && typeof p.price == 'number'){
						itemPrice = Math.round(p.price * 100) / 100;
					} else {
						throw OperationFailed.addToCart('Price is undefined');
					}

					if(existingItem){
						let itemOptions : CartUpdateOption;

						if(itemQuantity){
							itemOptions = {
								name: existingItem.name,
								price: existingItem.price,
								// quantity: { value: itemQuantity, relative: true}
								quantity: existingItem.quantity + itemQuantity
							};
						} else {
							throw OperationFailed.addToCart('Quantity is undefined');
						}

						existingItemOptions.push({item_id: existingItem.item_id, options: itemOptions});
					} else {
						items.push({
							item_id: String(p.item_id?? instance.items.length + 1),
							id: String(p.id),
							name: p.name,
							price: itemPrice,
							quantity: itemQuantity,
							options: p.options || [],
						});
					}

					if(p.conditions){
						Array.prototype.push.apply(instance.conditions, p.conditions);
					}
				});

				// Put new items into database
				Array.prototype.push.apply(instance.items, items);
						await storage.put(this._session, storage.serialise( this.compute(instance) ));

				existingItems = await this.asyncForEach(existingItemOptions, async item => {
					return await this.update(item.item_id, item.options);
				});

				// Merge new and existing items together to return
				items = items.concat(existingItems);

				resolve(items.length>1? items : items[0] as any);
			}catch(error){
				reject(error);
			}
		})
  	}

	/**
	 * Update a cart item
	 */
	public update(item_id: string|number, options: CartUpdateOption): Promise<CartItem> {
    	const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();
				const existingItem = instance.items.find(item => item.item_id == item_id);

				if(existingItem){
					if(options.name) existingItem.name = options.name;
					if(options.price) existingItem.price = options.price;
					if(options.options) existingItem.options = options.options;

					// Only update quanity if set
					if(has(options, 'quantity')){
						if (typeof options.quantity === 'number') {
							existingItem.quantity = options.quantity;
						} else {
							let optionQuantity : number = 0;
							if(typeof options.quantity?.value === 'string'){
								optionQuantity = parseInt(options.quantity.value); // Round to 2 decimal places
							} else {
								optionQuantity = get(options, 'quantity.value', optionQuantity);
							}

							if(get(options, 'quantity.relative', false)){
								existingItem.quantity += optionQuantity;
							} else {
								existingItem.quantity = optionQuantity;
							}
						}
					}
				} else {
					console.log({ items: instance.items, item_id })
					throw OperationFailed.cartUpdate('Item id does not exist');
        		}

				await storage.put(this._session, storage.serialise( this.compute(instance) ));

				resolve(existingItem);
			}catch(error){
				reject(error);
			}
		})
	}

	/**
	 * Update a cart item
	 */
	public remove<T extends string | number | Array<string|number>>(item_id: T): Promise<CartContent>{
    	const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();
				let ids = (item_id instanceof Array)? item_id : [item_id]

				ids.forEach(item_id => {
					var index = instance.items.findIndex(item => item.item_id == item_id);
					if (index > -1) {
						instance.items.splice(index, 1);
					}
				})

				await storage.put(this._session, storage.serialise( this.compute(instance) ));

				resolve(await this.content());
			}catch(error){
				reject(error);
			}
		})
	}

	/**
	 * Get cart item
	 */
	public get(item_id: string): Promise<CartItem> {
		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();
        const existingItem = instance.items.find(item => item.item_id.localeCompare(item_id) == 0);

        if(existingItem){
          resolve(existingItem);
        } else {
          throw OperationFailed.getItem('Item id does not exist');
        }
      }catch(error){
				reject(error);
			}
    });
	}

	/**
	 * Apply a condition or conditions to cart
	 */
	public apply(condition: CartCondition | Array<CartCondition>): Promise<any> {
    	const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{

				let conditions = (condition instanceof Array)? condition : [condition]

				const instance = await this.content();
				conditions.forEach(newCon => {
					const matchingCon = instance.conditions.find(oldCon => oldCon.name == newCon.name);

					// Add if condition with matching name doesn't already exist
					if(!matchingCon){
						instance.conditions.push(newCon);
					}
				});

				await storage.put(this._session, storage.serialise( this.compute(instance) ));

				resolve(true);
			}catch(error){
				reject(error);
			};
		});
	}

	/**
	 * Get all cart conditions
	 */
	public conditions(): Promise<Array<CartCondition>> {
		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();

        resolve(instance.conditions);
      }catch(error){
        reject(error);
      };
    });
	}

	/**
	 * Retrieve a cart condition
	 */
	public condition(name: string): Promise<CartCondition> {
		const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();
				const matchingCon = instance.conditions.find(con => con.name == name);

				if(matchingCon){
					resolve(matchingCon);
				} else {
					throw OperationFailed.condition('Condition does not exist');
				}
			}catch(error){
				reject(error);
			};
		});
	}

	/**
	 * Remove a cart condition
	 */
	public removeCondition(name: string): Promise<boolean> {
    	const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();
        const matchingConIndex = instance.conditions.findIndex(con => con.name == name);

        if(matchingConIndex < 0){
          throw OperationFailed.condition('Condition not found');
        } else {
          // Remove condition at index
          instance.conditions.splice(matchingConIndex, 1);

          await storage.put(this._session, storage.serialise( this.compute(instance) ));

          resolve(true);
        }
      }catch(error){
        reject(error);
      };
    });
	}

	/**
	 * Clear cart conditions
	 */
	public clearConditions(): Promise<boolean> {
		const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();
				instance.conditions = [];

				await storage.put(this._session, storage.serialise( this.compute(instance) ));

				resolve(true);
			}catch(error){
				reject(error);
			};
		});
	}

	/**
	 * Check if cart is empty
	 */
	public empty(): Promise<boolean> {
		return new Promise(async resolve => {
			resolve(!(await this.count()))
		});
	}

	/**
	 * Count number of items in cart
	 */
	public count(): Promise<number> {
		return new Promise(async resolve => {
			resolve((await this.items()).length)
		});
	}

	/**
	 * Get cart contents
	 */
	public content(): Promise<CartContent> {
		return new Promise(async (resolve, reject) => {
			const storage = this.storage();
			try{
				let raw = await storage.get(this._session);
				if(raw){
					resolve( storage.parse(raw) as CartContent )
				}
				resolve(
					{
						items: [],
						conditions: [],
						subtotal: 0,
						total: 0
					} as CartContent
				);
			}catch(error){
				reject(error);
			}
		});
	}

	/**
	 * List cart items
	 */
	public items(): Promise<Array<CartItem>> {
		return new Promise(async (resolve, reject) => {
			try {
				resolve((await this.content()).items)
			} catch(error) {
				reject(error);
			}
		});
	}

	/**
	 * Get cart subtotal
	 */
	public subtotal(): Promise<number> {
		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();

        resolve(instance.subtotal);
      }catch(error){
        reject(error);
      };
    });
	}

	/**
	 * Get cart total
	 */
	public total(): Promise<number> {
		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();

        resolve(instance.total);
      }catch(error){
        reject(error);
      };
    });
	}

	/**
	 * Clear cart contents
	 */
	public clear(): Promise<boolean> {
		const storage = this.storage();

		return new Promise(async (resolve, reject) => {
			try{
				let instance = await this.content();
				instance.items = [];

				await storage.put(this._session, storage.serialise( this.compute(instance) ));

				resolve(true);
			}catch(error){
				reject(false);
			}
		})
	}

	/**
	 * Generic async for each
	 */
  private async asyncForEach<T>(array: T[], callback: (item: T, index: number, allItems: T[]) => any): Promise<any> {
    let arrayItems : Array<any> = [];
    for(let index = 0; index < array.length; index++){
      arrayItems.push(await callback(array[index], index, array));
    }
    return arrayItems;
  }
}
