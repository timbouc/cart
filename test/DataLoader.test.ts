/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import DataLoader from "../src/DataLoader";
import path from "path";
const { expect } = require("chai");

const key = "key-1";
const loader = new DataLoader(key, {
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

describe("Data Loader", () => {
  it("basic set/get", async () => {
    await loader.set({ name: "test" });
    const name = await loader.get("name");
    expect(name).to.equal("test");
  });
});
