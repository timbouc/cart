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
    
    let itemsValues : Map<string, number> = new Map();
    Array.from(instance.items).forEach(item => {
      itemsValues.set(item.id, item.price * item.quantity);
    });

    instance.subtotal = Array.from(instance.items).reduce((a, b) => a + b.price * b.quantity, 0);
    instance.total = instance.subtotal;

    // Sort by items first, then subtotals, then totals.
    // Within each of items, subtotals and totals, sort most importantly by order then, for items only, by target
    instance.conditions = Array.from(instance.conditions).sort((a, b) => 
      (
        (a.target == 'total' && b.target == 'total' && a.order < b.order) ||
        (a.target != 'total' && b.target == 'total') ||
        (a.target == 'subtotal' && b.target == 'subtotal' && a.order < b.order) ||
        (a.target != 'subtotal' && a.target != 'total' && b.target == 'subtotal') ||
        (a.order < b.order && a.target == b.target) ||
        (a.order == b.order && a.target < b.target)
      ) ? -1 : 1
    );

    let updatedSubtotalAfterItems = false;
    let updatedTotalAfterSubtotals = false;

    Array.from(instance.conditions).forEach(condition => {
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
          instance.subtotal = Array.from(itemsValues.values()).reduce((a, b) => a + b, 0);
          updatedSubtotalAfterItems = true;
        }

        instance.subtotal = this.updatePrice(instance.subtotal, multiplyValue, condition.value);
      } else if(condition.target == 'total'){
        if(!updatedTotalAfterSubtotals){
          // Check total has been reset after subtotal updated
          instance.total = instance.subtotal;
          updatedTotalAfterSubtotals = true;
        }

        instance.total = this.updatePrice(instance.total, multiplyValue, condition.value);
      } else {
        let itemPrice = itemsValues.get(condition.target);
        if(!itemPrice){
          throw OperationFailed.getItem('Item price was not found');
        }
        itemsValues.set(condition.target, this.updatePrice(itemPrice, multiplyValue, condition.value));
      }
    });

    // Once again, check subtotal and totals have been calculated (no conditions must have been applied)
    if(!updatedSubtotalAfterItems){
      instance.subtotal = Array.from(itemsValues.values()).reduce((a, b) => a + b, 0);
    }
    if(!updatedTotalAfterSubtotals){
      instance.total = instance.subtotal;
    }

		return instance;
  }

	/**
	 * Perform multiply or add operation on price
	 */
  private updatePrice(initialPrice: number, multiplyValue: boolean, change: number): number {
    if(multiplyValue){
      return initialPrice + initialPrice * change;
    }
    return initialPrice + change;
  }
  
  private parseStringConditionValue(value: string): [boolean, number] {
    try {
      if(value.includes('%')){
        if(!value.match('^\d+%?$')){
          throw OperationFailed.parseString(`Invalid character(s) in condition value: ${value}`);
        }
        let valueParts = value.split('%');
        valueParts = valueParts.filter(el => {
          return el != '' && el != ' ' && el != null;
        });
        if(valueParts.length == 1){
          return [true, parseInt(valueParts[0])];
        }
        throw OperationFailed.parseString(`Invalid percentage: ${value}`);
      }
      return [false, parseInt(value)];
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
	public add(product: CartInputItem | Array<CartInputItem>): Promise<CartItem | Array<CartItem>> {
		const storage = this.storage()

		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();

				if(!(product instanceof Array)){
					product = [product];
				}
				let items: Array<CartItem> = [];
				let existingItems: Array<CartItem> = [];
				let existingItemOptions: { id: number | string, options: CartUpdateOption }[] = [];

				product.forEach(p => {
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

						existingItemOptions.push({id: existingItem.id, options: itemOptions});
					} else {
						items.push({
							_id: String(p._id?? instance.items.length + 1),
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

        existingItems = await this.asyncForEach(existingItemOptions, async(item) => {
          return await this.update(item.id, item.options);
        });

				// Merge new and existing items together to return
				items = items.concat(existingItems);

				resolve(items.length>1? items : items[0]);
			}catch(error){
				reject(error);
			}
		})
  }

	/**
	 * Update a cart item
	 */
	public update(id: string|number, options: CartUpdateOption): Promise<CartItem> {
    const storage = this.storage();
    
		return new Promise(async (resolve, reject) => {
			try{
				const instance = await this.content();
				const existingItem = instance.items.find(item => item.id == id);

				if(existingItem){
					existingItem.name = options.name;
					existingItem.price = options.price;

					// Only update quanity if set
					if(has(options, 'quantity')){
						if (typeof options.quantity === 'number') {
							existingItem.quantity = options.quantity;
						} else {
							let optionQuantity : number = 0;
							if(typeof options.quantity.value === 'string'){
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
	 * Get cart item
	 */
	public get(id: string): Promise<CartItem> {
		return new Promise(async (resolve, reject) => {
			try{
        const instance = await this.content();
        const existingItem = instance.items.find(item => item.id.localeCompare(id) == 0);

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
        if(!(condition instanceof Array)){
          condition = [condition];
        }

        const instance = await this.content();
        condition.forEach(newCon => {
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
		const storage = this.storage();
		return new Promise(async (resolve, reject) => {
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
