/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import path from "path";
import { get } from "lodash";
import { Cart, CartCondition } from "../src";
const { expect } = require("chai");

const session = "user-1";
const cart = new Cart(session, {
  default: "local",
  storages: {
    local: {
      driver: "local",
      config: {
        path: path.join(__dirname, "test.storage.file")
      }
    }
  }
});

describe("Cart Operations", async () => {
  it("add to cart", async () => {
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30
    });
    expect(await cart.empty()).to.equal(false);
  });
  it("add to cart again, but expect cart size NOT to change", async () => {
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30
    });
    expect(await cart.count()).to.equal(1);
  });
  it("add to cart with options, this time expect cart size to change", async () => {
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30,
      options: [
        {
          type: "Colour",
          value: "red"
        }
      ]
    });
    expect(await cart.count()).to.equal(2);
  });
  it("add to cart with options again, expect cart size NOT to change", async () => {
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30,
      options: [
        {
          type: "Colour",
          value: "red"
        }
      ]
    });
    expect(await cart.count()).to.equal(2);
  });
  it("add to cart and check quantity", async () => {
    await cart.clear();
    // await cart.storage().clear()
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30
    });
    let i1 = await cart.add({
      id: 1,
      name: "Product 1",
      price: 30,
      quantity: 3 // should accumulate
    });
    let i2 = await cart.update(i1.item_id, {
      name: "Product 1",
      price: 30,
      quantity: {
        // should NOT override
        relative: true,
        value: 1
      }
    });
    let i3 = await cart.add({
      id: 2,
      name: "Product 2",
      price: 30,
      quantity: 3 // should accumulate
    });
    await cart.remove(i3.item_id);

    expect(i1.quantity).to.equal(4);
    expect(i2.quantity).to.equal(5);
    expect(await cart.count()).to.equal(1);
  });
  it("check subtotal and total", async () => {
    await cart.clear();
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30
    });
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30,
      quantity: 3 // should accumulate
    });

    expect(await cart.subtotal()).to.equal(120);
    expect(await cart.total()).to.equal(120);
  });
  it("check conditions targeted at subtotal", async () => {
    await cart.clear();
    await cart.clearConditions();
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 20
    });
    await cart.apply([
      {
        name: "+10% Tax",
        type: "voucher",
        target: "subtotal",
        value: "+10%"
      },
      {
        name: "+5% Tax 1",
        type: "voucher",
        target: "subtotal",
        value: "+5%"
      },
      {
        name: "-5% Tax 1", // -5% tax 🤣 🤣
        type: "voucher",
        target: "subtotal",
        value: "-5%"
      }
    ] as Array<CartCondition>);

    expect(await cart.subtotal()).to.equal(20);
    expect(await cart.total()).to.equal(22);
  });
  it("check subtotal and total against conditions", async () => {
    await cart.clear();
    await cart.clearConditions();
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 20
    });
    let i1 = await cart.add({
      id: 2,
      name: "Product 2",
      price: 40,
      quantity: 3 // should accumulate
    });
    await cart.apply({
      name: "Voucher 1 for item " + i1.item_id,
      type: "voucher",
      target: i1.item_id,
      value: -10 // removes the value `10` from i1
      // order: 1,
    });
    await cart.apply({
      name: "Voucher 2 for item " + i1.item_id,
      type: "voucher",
      target: i1.item_id,
      value: "-10%" // removes 10% of `40` from i1
      // order: 1,
    });
    await cart.apply({
      name: "tax",
      type: "tax",
      target: "subtotal",
      value: "10%" // adds 10% of `98`
      // order: 1,
    });
    await cart.apply({
      name: "use prepaid credit",
      type: "discount",
      target: "total",
      value: "-15" // removes 15 from 107.8
      // order: 1,
    });

    expect(await cart.subtotal()).to.equal(98);
    expect(await cart.total()).to.equal(92.8);
  });
  it("add to cart with custom field", async () => {
    // Add custom field existing item in cart in cart
    let i1 = await cart.add({
      id: 1,
      name: "Product 1",
      price: 20,
      workspace: "Timbouc"
    });
    // Add new item with custom field
    let i2 = await cart.add({
      id: 100,
      name: "Product 100",
      price: 20,
      workspace: "Timbouc"
    });

    expect(i1.workspace).not.to.equal("Timbouc");
    expect(i2.workspace).to.equal("Timbouc");
  });
  it("get/put miscellaneous data", async () => {
    // Get or put miscellaneous data
    let d1 = await cart.data("checkout_contact", "johndoe@timbouc.com");
    let d2 = await cart.data("checkout_contact");
    await cart.data("customer.name", "Johnn Doe");
    await cart.data("customer.email", "johndoe@mail.com");
    let d3 = await cart.data("customer");
    let d4 = await cart.data("customer.email");

    expect(d1).to.equal("johndoe@timbouc.com");
    expect(d2).to.equal("johndoe@timbouc.com");
    expect(get(d3, "name")).to.equal("Johnn Doe");
    expect(d4).to.equal("johndoe@mail.com");
    expect(get(await cart.content(), "data.customer.name")).to.equal(
      "Johnn Doe"
    );
  });
  it("get/put miscellaneous data [2]", async () => {
    await cart.data({
      checkout_contact: "johndoe@timbouc.com",
      customer: {
        name: "Johnn Doe"
      }
    });

    const data = await cart.data();
    expect(get(data, "checkout_contact")).to.equal("johndoe@timbouc.com");
    expect(get(data, "customer.name")).to.equal("Johnn Doe");
  });
  it("apply condition twice but expect to be replaced", async () => {
    let con1 = await cart.apply({
      name: "Shipping",
      type: "shipping",
      target: "total",
      value: 10
    });
    let con2 = await cart.apply({
      name: "Shipping",
      type: "shipping",
      target: "total",
      value: 12
    });
    let con3 = await cart.condition("Shipping");

    expect(con1.value).to.equal(10);
    expect(con2.value).to.equal(12);
    expect(con3.value).to.equal(12);
  });
});
