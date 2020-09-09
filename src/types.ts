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
	default?: string;
	storages?: CartStorageConfig;
}

export interface CartContent{
	items: Array<CartItem>;
	conditions: Array<CartCondition>;
	subtotal: number;
	total: number;
}

export interface CartItemOption{
	[key: string]: any;
}

export interface CartProduct {
	_id: string|number;
	id: string|number;
	name: string;
	price: string|number;
	quantity?: number|string;
	conditions?: Array<CartCondition>;
	options?: Array<CartItemOption>;
}

export interface CartItem {
	id: number;
	name: string;
	price: number;
	quantity: number;
	options?: Array<CartItemOption>;
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
    target: string | 'subtotal' | 'total';
	value: string|number;
	order: number;
    attributes: {
		[key: string]: any
    };
}
