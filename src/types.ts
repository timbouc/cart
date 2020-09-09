/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { LocalFileSystemStorageConfig } from './LocalFileCartStorage';

export type { LocalFileSystemStorageConfig };

export type StorageSingleDriverConfig =
	| {
			driver: 'local';
			config: LocalFileSystemStorageConfig;
	  }
	| {
			driver: string;
			config: unknown;
	  };

export interface CartStorageConfig {
	[key: string]: StorageSingleDriverConfig;
}

export interface CartConfig {
	/**
	 * The default disk returned by `disk()`.
	 */
	default?: string;
	storages?: CartStorageConfig;
}

export interface CartContent{
	items: Array<CartItem>;
	conditions: Array<CartCondition>;
	subtotal: number;
	total: number;
}

export interface CartProduct {
	id: string|number;
	name: string;
	price: string|number;
	quantity: number|string;
	conditions: Array<CartCondition>
}

export interface CartItem {
	id: number;
	name: string;
	price: number;
	quantity: number;
}

export interface CartUpdateOption {
	name: string;
	price: number;
	quantity: number | {
		relative: boolean;
		value: string|number;
	};
}

export interface CartCondition {
	name: string;
	type: 'tax' | 'voucher' | 'sale' | 'discount' | 'coupon';
    target: 'subtotal' | 'total';
	value: string|number;
	order: number;
    attributes: {
		[key: string]: any
    };
}
