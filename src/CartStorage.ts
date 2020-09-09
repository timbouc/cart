/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { MethodNotSupported } from './exceptions';

export default abstract class CartStorage {
	/**
	 * Check if key exists
	 */
	has(key: string): Promise<boolean> {
		throw new MethodNotSupported('has');
	}

	/**
	 * Get cart item
	 */
	get(key: string): Promise<any> {
		throw new MethodNotSupported('get');
	}

	/**
	 * Put into storage
	 */
	put(key: string, value: any): Promise<any> {
		throw new MethodNotSupported('put');
	}

	/**
	 * Clear storage
	 */
	clear(): Promise<void> {
		throw new MethodNotSupported('clear');
	}
}
