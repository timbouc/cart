/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import path from 'path';
import { Cart, CartCondition, CartItem } from '../src';
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
		await cart.clear();
		// await cart.storage().clear()
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
		})
		let i1 = await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
			quantity: 3 // should accumulate
		}) as CartItem
		let i2 = await cart.update(i1._id, {
			name: 'Product 1',
			price: 30,
			quantity: { // should NOT override
				relative: true,
				value: 1
			}
		}) as CartItem

		expect(i1.quantity).to.equal(4);
		expect(i2.quantity).to.equal(5);
	});
	it('check subtotal and total', async () => {
		await cart.clear();
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
		})
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 30,
			quantity: 3 // should accumulate
		}) as CartItem

		expect(await cart.subtotal()).to.equal(120);
		expect(await cart.total()).to.equal(120);
	});
	it('check conditions targeted at subtotal', async () => {
		await cart.clear();
		await cart.clearConditions();
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 20,
		});
		await cart.apply([
			{
				name: '+10% Tax',
				type: 'voucher',
				target: 'subtotal',
				value: '+10%',
			},
			{
				name: '+5% Tax 1',
				type: 'voucher',
				target: 'subtotal',
				value: '+5%',
			},
			{
				name: '-5% Tax 1', // -5% tax 🤣 🤣
				type: 'voucher',
				target: 'subtotal',
				value: '-5%',
			},
		] as Array<CartCondition>);

		expect(await cart.subtotal()).to.equal(20);
		expect(await cart.total()).to.equal(22);
	});
	it('check subtotal and total against conditions', async () => {
		await cart.clear();
		await cart.clearConditions();
		await cart.add({
			id: 1,
			name: 'Product 1',
			price: 20,
		})
		let i1 = await cart.add({
			id: 2,
			name: 'Product 2',
			price: 40,
			quantity: 3 // should accumulate
		}) as CartItem
		await cart.apply({
			name: 'Voucher 1 for item ' + i1._id,
			type: 'voucher',
			target: i1._id,
			value: -10, // removes the value `10` from i1
			// order: 1,
		} as CartCondition)
		await cart.apply({
			name: 'Voucher 2 for item ' + i1._id,
			type: 'voucher',
			target: i1._id,
			value: '-10%', // removes 10% of `40` from i1
			// order: 1,
		} as CartCondition)
		await cart.apply({
			name: 'tax',
			type: 'voucher',
			target: 'subtotal',
			value: '10%', // adds 10% of `98`
			// order: 1,
		} as CartCondition)
		await cart.apply({
			name: 'use prepaid credit',
			type: 'voucher',
			target: 'total',
			value: '-15', // removes 15 from 107.8
			// order: 1,
		} as CartCondition)

		expect(await cart.subtotal()).to.equal(98);
		expect(await cart.total()).to.equal(92.8);
	});
});
