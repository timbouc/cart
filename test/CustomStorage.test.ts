/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import path from "path";
import { Cart, LocalFileCartStorage } from "../src";
const { expect } = require("chai");

class CustomStorage extends LocalFileCartStorage {
  //
}

const session = "user-1";
const cart = new Cart(session, {
  default: "custom",
  storages: {
    custom: {
      driver: "custom",
      config: {
        path: path.join(__dirname, "test.storage.file")
      }
    }
  }
});

cart.registerDriver("custom", CustomStorage);

describe("Custom Storage", async () => {
  await cart.clear();
  it("add to cart to test storage", async () => {
    await cart.add({
      id: 1,
      name: "Product 1",
      price: 30
    });
    expect(await cart.count()).to.equal(1);
  });
});
