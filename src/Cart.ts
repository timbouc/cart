/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { LocalFileCartStorage } from './LocalFileCartStorage';
import Storage from './CartStorage';
import { InvalidConfig, DriverNotSupported } from './exceptions';
import { CartConfig, CartStorageConfig, StorageSingleDriverConfig, CartContent, CartProduct, CartItem, CartUpdateOption, CartCondition, } from './types';
import { MethodNotSupported } from './exceptions';
import { CartStorage } from '.';

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

	constructor(config: CartConfig) {
		this.defaultStorage = config.default;
		this.storagesConfig = config.storages || {};
		this.registerDriver('local', LocalFileCartStorage);
	}

	/**
	 * Get the instantiated storages
	 */
	public getStorages(): Map<string, Storage> {
		return this._storages;
	}

	/**
	 * Get the registered drivers
	 */
	getDrivers(): Map<string, StorageConstructor<Storage>> {
		return this._drivers;
	}

	/**
	 * Set cart instance
	 * @param uuid
	 */
	public session(uuid: string): Cart{
		// set current session
		return this
	}

	/**
	 * Set current working driver
	 * @param uuid
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
	public add(item: CartProduct | Array<CartProduct>): Promise<CartItem> {
		// this.storage().put(key, JSON.stringify(item))
		throw new MethodNotSupported('add');
	}

	/**
	 * Update a cart item
	 */
	public update(id: string|number, options: CartUpdateOption): Promise<CartItem> {
		throw new MethodNotSupported('update');
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
	public condition(condition: CartCondition | Array<CartCondition>): Promise<any> {
		throw new MethodNotSupported('condition');
	}

	/**
	 * Retrieve a cart condition
	 */
	public getCondition(name: string): Promise<CartCondition> {
		throw new MethodNotSupported('getCondition');
	}

	/**
	 * Remove a cart condition
	 */
	public removeCondition(name: string): Promise<boolean> {
		throw new MethodNotSupported('removeCondition');
	}

	/**
	 * Retrieve a cart condition
	 */
	public removeCartItemCondition(name: string): Promise<boolean> {
		throw new MethodNotSupported('removeCartItemCondition');
	}

	/**
	 * Check if cart is empty
	 */
	public empty(): Promise<boolean> {
		throw new MethodNotSupported('empty');
	}

	/**
	 * List cart items
	 */
	public list(): Promise<Array<CartItem>> {
		throw new MethodNotSupported('list');
	}

	/**
	 * Get cart contents
	 */
	public content(): Promise<CartContent> {
		throw new MethodNotSupported('content');
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
