/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { LocalFileCartStorage } from './LocalFileCartStorage';
import Storage from './CartStorage';
import { InvalidConfig, DriverNotSupported } from './exceptions';
import { CartConfig, CartStorageConfig, StorageSingleDriverConfig, CartContent, CartInputItem, CartItem, CartUpdateOption, CartCondition, } from './types';
import { MethodNotSupported } from './exceptions';
import { resolve } from 'path';

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
		return instance;
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
          let existingItem = instance.items.find(item => 
            (item.id == p.id && 
            (!item.options && !p.options) || 
            ((item.options && p.options) && item.options!.length == p.options!.length &&
            (item.options!.every(option => p.options!.indexOf(option) > -1))))
          );

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
            throw 'Price is undefined';
          }

          if(existingItem){
            let itemOptions : CartUpdateOption;
            
            if(itemQuantity){
              itemOptions = {
                name: existingItem.name,
                price: existingItem.price,
                quantity: { value: itemQuantity, relative: true}
              };
            } else {
              throw 'Quantity is undefined';
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

          if (typeof options.quantity === 'number') {
            existingItem.quantity = options.quantity;
          } else {
            let optionQuantity : number = 0;
            if(typeof options.quantity.value === 'string'){
              optionQuantity = parseInt(options.quantity.value); // Round to 2 decimal places
            } else {
              optionQuantity = options.quantity.value;
            }

            if(options.quantity.relative){
              existingItem.quantity += optionQuantity;
            } else {
              existingItem.quantity = optionQuantity;
            }
          }
        } else {
          throw 'Item id does not exist';
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
          reject('Item id does not exist');
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
		throw new MethodNotSupported('condition');
	}

	/**
	 * Get all cart conditions
	 */
	public conditions(): Promise<Array<CartCondition>> {
		throw new MethodNotSupported('conditions');
	}

	/**
	 * Retrieve a cart condition
	 */
	public condition(name: string): Promise<CartCondition> {
		throw new MethodNotSupported('getCondition');
	}

	/**
	 * Remove a cart condition
	 */
	public removeCondition(name: string): Promise<void> {
		throw new MethodNotSupported('removeCondition');
	}

	/**
	 * Clear cart conditions
	 */
	public clearConditions(name: string): Promise<void> {
		throw new MethodNotSupported('clearConditions');
	}

	/**
	 * Check if cart is empty
	 */
	public empty(): Promise<boolean> {
		return new Promise(async resolve => {
			resolve(!(await this.items()).length)
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
		throw new MethodNotSupported('subtotal');
	}

	/**
	 * Get cart total
	 */
	public total(): Promise<number> {
		throw new MethodNotSupported('total');
	}

	/**
	 * Clear cart contents
	 */
	public clear(): Promise<boolean> {
		throw new MethodNotSupported('clear');
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
