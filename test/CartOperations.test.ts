/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import path from 'path';
import { Cart, CartItem } from '../src';
const { expect } = require('chai');

const session = 'user-1';
const cart = new Cart(session, {
	default: 'local',
	storages: {
		local: {
			driver: 'local',
			config: {
				path: path.join(__dirname, 'test.storage.file'),
			},
		},
	},
});

describe('Cart Operations', async () => {
	it('add to cart', async () => {
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
		})
		expect(await cart.empty()).to.equal(false);
	});
	it('add to cart again, but expect cart size NOT to change', async () => {
		let cart_item = await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
		})
		expect(await cart.count()).to.equal(1);
	});
	it('add to cart with options, this time expect cart size to change', async () => {
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
			options: [{
				type: 'Colour',
				value: 'red'
			}]
		})
		expect(await cart.count()).to.equal(2);
	});
	it('add to cart with options again, expect cart size NOT to change', async () => {
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
			options: [{
				type: 'Colour',
				value: 'red'
			}]
		})
		expect(await cart.count()).to.equal(2);
	});
	it('add to cart and check quantity', async () => {
		// await cart.clear();
		await cart.storage().clear()
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
		})
		let i1 = await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
			quantity: 3 // should override
		}) as CartItem
		let i2 = await cart.update(i1._id, {
			name: 'Product 1',
			price: 30,
			quantity: { // should NOT override
				relative: true,
				value: 1
			}
		}) as CartItem

		expect(i1.quantity).to.equal(3);
		expect(i2.quantity).to.equal(4);
	});
});
