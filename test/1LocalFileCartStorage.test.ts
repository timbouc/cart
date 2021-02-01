/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import path from "path";
import { LocalFileCartStorage } from "../src/LocalFileCartStorage";
const { expect } = require("chai");

const storage = new LocalFileCartStorage({
  path: path.join(__dirname, "test.storage.file")
});

describe("Local Storage", async () => {
  let key = "cart-" + Math.floor(Math.random() * Math.floor(100));
  let value = Math.floor(Math.random() * Math.floor(1000));

  it("should return false as key should not exist", async () => {
    const has = await storage.has(key);
    expect(has).to.equal(false);
  });

  it(`Set value ${value}, get should be equal`, async () => {
    await storage.put(key, value);
    const x = await storage.get(key);
    expect(x).to.equal(value);
  });

  it("should return true as key should now exist", async () => {
    const has = await storage.has(key);
    expect(has).to.equal(true);
  });

  it("should return false again, as key should be cleared", async () => {
    await storage.clear();
    const has = await storage.has(key);
    expect(has).to.equal(false);
  });
});
