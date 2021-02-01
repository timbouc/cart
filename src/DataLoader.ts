/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { set, has, get, throttle, DebouncedFunc, cloneDeep } from "lodash";
import { LocalFileCartStorage } from "./LocalFileCartStorage";
import Storage from "./CartStorage";
import { InvalidConfig, DriverNotSupported } from "./exceptions";
import {
  CartConfig,
  CartStorageConfig,
  StorageConstructor,
  StorageSingleDriverConfig
} from "./types";

export default class DataLoader {
  /**
   * Current data access key (Session)
   */
  private _key: string;

  /**
   * Data access buffer
   */
  private data: Record<string, unknown>;

  /**
   * Data storage write throttle handler instance
   */
  private save: DebouncedFunc<any>;

  /**
   * Data storage read throttle handler instance
   */
  private load: DebouncedFunc<any>;

  /**
   * Data storage write throttle delay
   */
  private write_throttle_wait: number;

  /**
   * Data storage read throttle delay
   */
  private read_throttle_wait: number;

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

  constructor(key: string, config: CartConfig) {
    this._key = key;
    this.data = {};
    this.write_throttle_wait = config.write_throttle_wait || 1000;
    this.read_throttle_wait = config.read_throttle_wait || 1000;
    this.defaultStorage = config.default;
    this.storagesConfig = config.storages || {};
    this.registerDriver("local", LocalFileCartStorage);

    this.save = throttle(this.__save, this.write_throttle_wait, {
      trailing: true
    });

    this.load = throttle(this.__load, this.read_throttle_wait, {
      leading: true
    });
  }

  public key(value: string) {
    this.save.flush(); // hurry save pending data if key is being changed
    this.load.flush();
    this._key = value;
  }

  public async __save() {
    const storage = this.storage();
    await storage.put(this._key, storage.serialise(this.data));

    // If there is a pending read, read storage immediately and (re-)hidrate buffer.
    this.load.flush();
  }

  public async __load() {
    // If there is a pending write, write storage immediately before read.
    this.save.flush();

    const storage = this.storage();
    let raw = await storage.get(this._key);
    this.data = raw ? storage.parse(raw) : {};
  }

  public async set(key: string | Record<string, unknown>, value?: unknown) {
    if (value !== undefined) {
      set(this.data, key as string, value);
    } else {
      this.data = cloneDeep(key as Record<string, unknown>);
    }
    await this.save();
  }

  public async get(key?: string, deflt?: unknown) {
    await this.load();
    return key ? get(this.data, key, deflt) : this.data;
  }

  public async has(key: string): Promise<boolean> {
    await this.load();
    return has(this.data, key);
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
      return this._storages.get(name) as T;
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
  public registerDriver<T extends Storage>(
    name: string,
    storage: StorageConstructor<T>
  ): void {
    this._drivers.set(name, storage);
  }

  /**
   * Set current working driver
   * @param driver
   */
  public driver(driver: string) {
    this.storage(driver);
    this.defaultStorage = driver;
  }
}
