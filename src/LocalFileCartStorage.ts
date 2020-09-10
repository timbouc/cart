/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import * as fs from 'fs';
import { resolve } from 'path';
import CartStorage from './CartStorage';

export class LocalFileCartStorage extends CartStorage {
	private $path: string;

	constructor(config: LocalFileSystemStorageConfig) {
		super();
		this.$path = resolve(config.path);
		if (!fs.existsSync(this.$path)) {
            fs.writeFileSync(this.$path, JSON.stringify({}), config.encoding || 'utf8');
        }
	}

	private getFileContent(): Record<string, any> {
        return JSON.parse(fs.readFileSync(this.$path).toString());
	}
	private updateData(data: Record<string, any>) {
        fs.writeFileSync(this.$path, JSON.stringify(data));
    }

	/**
	 * Check if key exists
	 */
	async has(key: string) {
        return !!this.getFileContent()[key];
	}

	/**
	 * Get cart item
	 */
	async get(key: string) {
		// @ts-ignore
        return this.getFileContent()[key];
	}

	/**
	 * Put into storage
	 */
	async put(key: string, value: any) {
		this.updateData({
            ...this.getFileContent(),
            [key]: value,
		});
		return value
	}

	/**
	 * Clear storage
	 */
	async clear(){
		this.updateData({})
	}
}

export type LocalFileSystemStorageConfig = {
	path: string;
	encoding?: string;
};
