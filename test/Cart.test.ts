/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import CartStorage from "../src/CartStorage";
import Cart from "../src/Cart";
import { LocalFileCartStorage } from "../src/LocalFileCartStorage";
import { InvalidConfig, DriverNotSupported } from "./../src/exceptions";
const { expect } = require("chai");

const session = "user-1";

describe("CartStorage Manager", () => {
  it("throw exception when no driver name is defined", () => {
    const cart = new Cart(session, {});
    const fn = (): CartStorage => cart.storage();
    expect(fn).to.throw(InvalidConfig.missingStorageName().message);
  });

  it("throw exception when storage config is missing", () => {
    const cart = new Cart(session, {
      default: "local"
    });
    const fn = (): CartStorage => cart.storage();
    expect(fn).to.throw(InvalidConfig.missingStorageConfig("local").message);
  });

  it("throw exception when storage config doesnt have driver", () => {
    const cart = new Cart(session, {
      default: "local",
      storages: {
        // @ts-expect-error
        local: {}
      }
    });
    const fn = (): CartStorage => cart.storage();
    expect(fn).to.throw(InvalidConfig.missingStorageDriver("local").message);
  });

  it("throw exception when driver is invalid", () => {
    const cart = new Cart(session, {
      default: "local",
      storages: {
        local: {
          driver: "foo",
          config: {
            path: ""
          }
        }
      }
    });
    const fn = (): CartStorage => cart.storage();
    expect(fn).to.throw(DriverNotSupported.driver("foo").message);
  });

  it("return storage instance for a given driver", () => {
    const cart = new Cart(session, {
      default: "local",
      storages: {
        local: {
          driver: "local",
          config: {
            path: ""
          }
        }
      }
    });
    const localDriver = cart.storage("local");
    expect(localDriver).to.be.instanceOf(LocalFileCartStorage);
  });

  it("extend and add new drivers", () => {
    const cart = new Cart(session, {
      default: "local",
      storages: {
        local: {
          driver: "foo",
          config: {}
        }
      }
    });

    class FooDriver extends CartStorage {}
    cart.registerDriver("foo", FooDriver);
    expect(cart.storage("local")).to.be.instanceOf(FooDriver);
  });

  it("get storage with custom config", () => {
    const cart = new Cart(session, {
      default: "local",
      storages: {
        local: {
          driver: "local",
          config: {
            path: ""
          }
        }
      }
    });
    const localWithDefaultConfig = cart.storage("local");
    expect(localWithDefaultConfig).to.be.instanceOf(LocalFileCartStorage);
  });
});
