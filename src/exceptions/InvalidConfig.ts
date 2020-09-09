/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */


export class InvalidConfig extends Error {
	public static missingStorageName(): InvalidConfig {
		return new this('Make sure to define a default storage name inside config file');
	}

	public static missingStorageConfig(name: string): InvalidConfig {
		return new this(`Make sure to define config for ${name} storage`);
	}

	public static missingStorageDriver(name: string): InvalidConfig {
		return new this(`Make sure to define driver for ${name} storage`);
	}

	public static duplicateStorageName(name: string): InvalidConfig {
		return new this(`A storage named ${name} is already defined`);
	}
}
