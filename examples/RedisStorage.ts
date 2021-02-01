// @ts-nocheck

import { CartStorage } from "@timbouc/cart";
import Redis, { RedisOptions } from "ioredis";

export class RedisStorage extends CartStorage {
  readonly client: Redis;

  constructor(config) {
    super();
    const client = new Redis(config as RedisOptions);
    this.client = client;
  }

  /**
   * Check if key exists
   */
  async has(key: string) {
    let value = await this.client.get(key);
    return !!value;
  }

  /**
   * Get cart item
   */
  async get(key: string) {
    return this.client.get(key);
  }

  /**
   * Put into storage
   */
  async put(key: string, value: any) {
    return this.client.set(key, value);
  }

  /**
   * Clear storage
   */
  async clear() {
    // return this.client.del(key)
  }
}
