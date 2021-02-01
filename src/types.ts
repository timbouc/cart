/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import Storage from "./CartStorage";
import { LocalFileSystemStorageConfig } from "./LocalFileCartStorage";

export { LocalFileSystemStorageConfig };

export type StorageSingleDriverConfig =
  | {
      driver: "local";
      config: LocalFileSystemStorageConfig;
    }
  | {
      driver: string;
      config: unknown;
    };

export interface CartStorageConfig {
  [key: string]: StorageSingleDriverConfig;
}

export interface CartConfig {
  default?: string;
  write_throttle_wait?: number;
  read_throttle_wait?: number;
  hooks?: ComputeHooks;
  storages?: CartStorageConfig;
}

export interface CartContent {
  items: Array<CartItem>;
  conditions: Array<CartCondition>;
  subtotal: number;
  total: number;
  data?: {
    [key: string]: any;
  };
}

export interface StorageConstructor<T extends Storage = Storage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}

export interface CartItemOption {
  [key: string]: any;
}

export interface CartInputItem {
  item_id?: string | number;
  id: string | number;
  name: string;
  price: string | number;
  quantity?: number | string;
  conditions?: Array<CartCondition>;
  options?: Array<CartItemOption>;
  [key: string]: any;
}

export interface CartItem {
  item_id: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Array<CartItemOption>;
  [key: string]: any;
}

export interface CartUpdateOption {
  name?: string;
  price?: number;
  quantity?:
    | number
    | {
        relative: boolean;
        value: string | number;
      };
  options?: Array<CartItemOption>;
}

export interface CartCondition {
  name: string;
  type: "tax" | "voucher" | "sale" | "discount" | "coupon" | "shipping";
  target: string | "subtotal" | "total";
  value: string | number;
  order?: number;
  attributes?: {
    [key: string]: any;
  };
}

export interface ResolvedCondition {
  name: string;
  value: number;
  is_percentage: boolean;
  item: CartItem | undefined;
}

export interface ComputeHooks {
  item: (item: CartItem, content: CartContent) => number;
  condition: (condition: ResolvedCondition, content: CartContent) => number;
}
