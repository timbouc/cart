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

				product.forEach(p => {
					// TODO: check if item already exists then increment by quantity or 1
					//		 check against `id` and `options`
					items.push({
						_id: String(p._id?? instance.items.length + 1),
						id: String(p.id),
						name: p.name,
						price: Number(p.price),
						quantity: Number(p.quantity || 1),
						options: p.options || [],
					});

					if(p.conditions){
						// instance.conditions.push.apply(null, p.conditions);
						Array.prototype.push.apply(instance.conditions, p.conditions);
					}
				});

				// instance.items.push.apply(null, items);
				Array.prototype.push.apply(instance.items, items);
				await storage.put(this._session, storage.serialise( this.compute(instance) ));

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
          } else if(options.quantity.relative){
            if(typeof existingItem.quantity === 'number' && typeof options.quantity.value === 'number') {
              existingItem.quantity += options.quantity.value;
            } else if(typeof existingItem.quantity === 'string' && typeof options.quantity.value === 'string') {
              existingItem.quantity = (parseFloat(existingItem.quantity) + parseFloat(options.quantity.value)).toString();
            } else {
              throw 'Conflict between quantity type and value';
            }
          } else if(typeof existingItem.quantity == typeof options.quantity) {
            existingItem.quantity = options.quantity.value;
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
	public get(id: string|number): Promise<CartItem> {
		throw new MethodNotSupported('get');
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
}
