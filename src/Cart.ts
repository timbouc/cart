/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

import { OperationFailed } from "./exceptions";
import Storage from "./CartStorage";
import {
  CartConfig,
  CartContent,
  CartInputItem,
  CartItem,
  CartUpdateOption,
  CartCondition,
  StorageConstructor,
  ComputeHooks
} from "./types";
import { get, has, isEqual } from "lodash";
import DataLoader from "./DataLoader";

interface ItemQuantityCost {
  price: number;
  quantity: number;
}

export default class Cart {
  /**
   * Data access.
   */
  private _loader: DataLoader;

  /**
   * Cart config.
   */
  private _config: CartConfig;

  /**
   * Compute hooks.
   */
  private hooks: ComputeHooks;

  constructor(session: string, config: CartConfig) {
    this._config = config;
    this.hooks = {
      item: (item) => item.quantity * item.price,
      condition: (condition) => condition.value,
      ...config.hooks
    };
    this._loader = new DataLoader(session, config);
  }

  /**
   * Get cart contents
   */
  private compute(instance: CartContent): CartContent {
    /**
     * TODO: compute conditions and items against subtotal,total
     * NOTE:
     * Compute sequence is critial.
     * Ideally: (1) sum items, (2) calculate subtotal +/- conditions, (3) calculate total
     * Remember CartCondition.order which specifies when it's applied. i.e. conditions of the same target should be sorted by order before being applied
     * Remember CartCondition.target which applies the condition ammount to the targeted item, subtotal or total
     * Remember CartCondition.value which (for a value of 10) can take the form `10`,`-10`,`"10"`,`"+10"`,`"-10"`,`"10%"`
     */

    let initialItemsValues: Map<string, ItemQuantityCost> = new Map();
    let itemsValues: Map<string, ItemQuantityCost> = new Map();
    instance.items.forEach((item) => {
      initialItemsValues.set(item.id, {
        price: item.price,
        quantity: item.quantity
      });
      itemsValues.set(item.id, { price: item.price, quantity: item.quantity });
    });

    instance.subtotal = instance.items.reduce(
      // (a, b) => a + b.price * b.quantity,
      (acc, item) => acc + this.hooks.item(item, instance),
      0
    );
    instance.total = instance.subtotal;
    let initialSubtotal: number = instance.subtotal;
    let initialTotal: number = instance.total;

    // Sort by items first, then subtotals, then totals.
    // Within each of items, subtotals and totals, sort most importantly by order then, for items only, by target
    instance.conditions = instance.conditions.sort((a, b) =>
      (a.target === "total" &&
        b.target === "total" &&
        get(a, "order", 0) < get(b, "order", 0)) ||
      (a.target !== "total" && b.target === "total") ||
      (a.target === "subtotal" &&
        b.target === "subtotal" &&
        get(a, "order", 0) < get(b, "order", 0)) ||
      (a.target !== "subtotal" &&
        a.target !== "total" &&
        b.target === "subtotal") ||
      (get(a, "order", 0) < get(b, "order", 0) && a.target === b.target) ||
      (get(a, "order", 0) === get(b, "order", 0) && a.target < b.target)
        ? -1
        : 1
    );

    // Copy conditions so we don't modify instance.conditions and prevent converting strings to numbers
    // e.g. we prevent '10%', a string, a.k.a multiplication of 0.1, getting converted to 0.1, a number, a.k.a addition of 0.1
    let conditions: Array<CartCondition> = [];
    instance.conditions.forEach((condition) => {
      conditions.push({
        name: condition.name,
        type: condition.type,
        target: condition.target,
        value: condition.value,
        order: condition.order,
        attributes: condition.attributes
      });
    });
    let updatedSubtotalAfterItems: boolean = false;
    let updatedTotalAfterSubtotals: boolean = false;

    conditions.forEach((condition) => {
      let multiplyValue: boolean = false;
      if (typeof condition.value === "string") {
        try {
          [multiplyValue, condition.value] = this.parseStringConditionValue(
            condition.value
          );
        } catch (error) {
          throw OperationFailed.compute(
            `Failed to compute after parse error: ${error}`
          );
        }
      }

      if (condition.target === "subtotal") {
        // Check subtotal has been recalculated after all item prices updated
        if (!updatedSubtotalAfterItems) {
          instance.subtotal = Array.from(itemsValues.values()).reduce(
            (a, b) => a + b.price * b.quantity,
            0
          );
          initialSubtotal = instance.subtotal;
          updatedSubtotalAfterItems = true;
        }

        instance.subtotal = this.updatePrice(
          initialSubtotal,
          instance.subtotal,
          multiplyValue,
          // condition.value
          this.hooks.condition(
            {
              name: condition.name,
              value: condition.value,
              is_percentage: multiplyValue,
              item: undefined
            },
            instance
          )
        );
      } else if (condition.target === "total") {
        if (!updatedTotalAfterSubtotals) {
          // Check total has been reset after subtotal updated
          instance.total = instance.subtotal;
          initialTotal = instance.total;
          updatedTotalAfterSubtotals = true;
        }

        instance.total = this.updatePrice(
          initialTotal,
          instance.total,
          multiplyValue,
          // condition.value
          this.hooks.condition(
            {
              name: condition.name,
              value: condition.value,
              is_percentage: multiplyValue,
              item: undefined
            },
            instance
          )
        );
      } else {
        let itemPrice = itemsValues.get(condition.target);
        let initialItemPrice = initialItemsValues.get(condition.target);
        if (!itemPrice || !initialItemPrice) {
          throw OperationFailed.getItem("Item price was not found");
        }
        const item = instance.items.find(
          (item) => item.item_id === condition.target
        );
        itemsValues.set(condition.target, {
          price: this.updatePrice(
            initialItemPrice.price,
            itemPrice.price,
            multiplyValue,
            // condition.value
            this.hooks.condition(
              {
                name: condition.name,
                value: condition.value,
                is_percentage: multiplyValue,
                item
              },
              instance
            )
          ),
          quantity: initialItemPrice.quantity
        });
      }
    });

    // At this stage, subtotal has been set temporarily to the value with all vouchers and taxes targeted
    // towards subtotal, in order to determine the total. We set total to this modified subtotal,
    // then recalculate subtotal as the sum of all items
    if (!updatedTotalAfterSubtotals) {
      instance.total = instance.subtotal;
    }
    if (updatedSubtotalAfterItems) {
      instance.subtotal = Array.from(itemsValues.values()).reduce(
        (a, b) => a + b.price * b.quantity,
        0
      );
    }

    return instance;
  }

  /**
   * Perform multiply or add operation on price
   * Percentages are calculated based on original price of item, subtotal or total
   */
  private updatePrice(
    initialPrice: number,
    currentPrice: number,
    multiplyValue: boolean,
    change: number
  ): number {
    if (multiplyValue) {
      return currentPrice + initialPrice * change;
    }
    return currentPrice + change;
  }

  private parseStringConditionValue(value: string): [boolean, number] {
    try {
      if (value.endsWith("%")) {
        value = value.substring(0, value.length - 1); // remove %
        return [true, parseFloat(value) / 100];
      }
      return [false, parseFloat(value)];
    } catch (error) {
      throw OperationFailed.parseString(`Invalid condition value: ${value}`);
    }
  }

  /**
   * Set cart session instance
   * @param session
   */
  public session(session: string): Cart {
    this._loader.key(session);
    return this;
  }

  /**
   * Add single or multiple items to cart
   */
  public add<T extends CartInputItem | Array<CartInputItem>>(
    product: T
  ): Promise<T extends CartInputItem ? CartItem : Array<CartItem>> {
    return new Promise(async (resolve, reject) => {
      try {
        const instance = await this.content();

        const isArray = product instanceof Array;
        let products = (isArray ? product : [product]) as Array<CartItem>;
        let items: Array<CartItem> = [];
        let existingItems: Array<CartItem> = [];
        let existingItemOptions: {
          item_id: number | string;
          options: CartUpdateOption;
        }[] = [];

        products.forEach((p) => {
          // Check if item already exists then increment by quantity or 1,
          //		 checking against `id` and `options`
          let existingItem = instance.items.find(
            (item) =>
              p.id == item.id &&
              p.price == item.price &&
              (!p.options?.length ||
                (item.options!.length &&
                  item.options!.length == p.options!.length &&
                  isEqual(item.options, p.options)))
          );

          let itemQuantity: number = 0;
          let itemPrice: number = 0;

          // Parse and specify default quantity of 1
          if (p.quantity && typeof p.quantity === "string") {
            itemQuantity = parseInt(p.quantity, 10);
          } else if (p.quantity && typeof p.quantity === "number") {
            itemQuantity = p.quantity;
          } else {
            itemQuantity = 1;
          }

          // Parse and round to 2 decimal places
          if (p.price && typeof p.price === "string") {
            itemPrice = Math.round(parseFloat(p.price) * 100) / 100;
          } else if (p.price && typeof p.price === "number") {
            itemPrice = Math.round(p.price * 100) / 100;
          } else {
            throw OperationFailed.addToCart("Price is undefined");
          }

          if (existingItem) {
            let itemOptions: CartUpdateOption;

            if (itemQuantity) {
              itemOptions = {
                name: existingItem.name,
                price: existingItem.price,
                // quantity: { value: itemQuantity, relative: true}
                quantity: existingItem.quantity + itemQuantity
              };
            } else {
              throw OperationFailed.addToCart("Quantity is undefined");
            }

            existingItemOptions.push({
              item_id: existingItem.item_id,
              options: itemOptions
            });
          } else {
            items.push({
              ...p,
              item_id: String(p.item_id ?? instance.items.length + 1),
              id: String(p.id),
              name: p.name,
              price: itemPrice,
              quantity: itemQuantity,
              options: p.options || []
            });
          }

          if (p.conditions) {
            Array.prototype.push.apply(instance.conditions, p.conditions);
          }
        });

        // Put new items into database
        Array.prototype.push.apply(instance.items, items);
        await this._loader.set(this.compute(instance) as any);

        existingItems = await this.asyncForEach(
          existingItemOptions,
          async (item) => {
            return await this.update(item.item_id, item.options);
          }
        );

        // Merge new and existing items together to return
        items = items.concat(existingItems);

        resolve(isArray ? items : (items[0] as any));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update a cart item
   */
  public update(
    item_id: string | number,
    options: CartUpdateOption
  ): Promise<CartItem> {
    return new Promise(async (resolve, reject) => {
      try {
        const instance = await this.content();
        const existingItem = instance.items.find(
          (item) => item.item_id === item_id
        );

        if (existingItem) {
          if (options.name) existingItem.name = options.name;
          if (options.price) existingItem.price = options.price;
          if (options.options) existingItem.options = options.options;

          // Only update quanity if set
          if (has(options, "quantity")) {
            if (typeof options.quantity === "number") {
              existingItem.quantity = options.quantity;
            } else {
              let optionQuantity: number = 0;
              if (typeof options.quantity?.value === "string") {
                optionQuantity = parseInt(options.quantity.value, 10); // cast to int
              } else {
                optionQuantity = get(options, "quantity.value", optionQuantity);
              }

              if (get(options, "quantity.relative", false)) {
                existingItem.quantity += optionQuantity;
              } else {
                existingItem.quantity = optionQuantity;
              }
            }
          }
        } else {
          throw OperationFailed.cartUpdate("Item id does not exist");
        }

        await this._loader.set(this.compute(instance) as any);

        resolve(existingItem);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update a cart item
   */
  public async remove<T extends string | number | Array<string | number>>(
    item_id: T
  ): Promise<CartContent> {
    const instance = await this.content();
    let ids = item_id instanceof Array ? item_id : [item_id];

    if (instance.items && instance.items.length) {
      ids.forEach((item_id) => {
        var index = instance.items.findIndex((item) => item.item_id == item_id);
        if (index > -1) {
          instance.items.splice(index, 1);
        }
      });
    }

    await this._loader.set(this.compute(instance) as any);

    return this.content();
  }

  /**
   * Get cart item
   */
  public async get(item_id: string): Promise<CartItem> {
    const instance = await this.content();
    const existingItem = instance.items.find(
      (item) => item.item_id.localeCompare(item_id) === 0
    );

    if (!existingItem) {
      throw OperationFailed.getItem("Item id does not exist");
    }

    return existingItem;
  }

  /**
   * Apply a condition or conditions to cart
   */
  public async apply<T extends CartCondition | Array<CartCondition>>(
    condition: T
  ): Promise<T extends CartCondition ? CartCondition : Array<CartCondition>> {
    const instance = await this.content();

    const isArray = condition instanceof Array;
    let conditions = (isArray ? condition : [condition]) as Array<
      CartCondition
    >;
    let newConditions: Array<CartCondition> = [];

    conditions.forEach((newCon) => {
      const index = instance.conditions.findIndex(
        (oldCon) => oldCon.name == newCon.name
      );
      if (index >= 0) {
        // Replace if condition with matching name already exist
        instance.conditions[index] = newCon;
      } else {
        // Add if condition with matching name doesn't already exist
        newConditions.push(newCon);
      }
    });

    Array.prototype.push.apply(instance.conditions, newConditions);

    await this._loader.set(this.compute(instance) as any);

    return (isArray ? conditions : conditions[0]) as any;
  }

  /**
   * Get all cart conditions
   */
  public async conditions(): Promise<Array<CartCondition>> {
    const instance = await this.content();
    return instance.conditions;
  }

  /**
   * Retrieve a cart condition
   */
  public async condition(name: string): Promise<CartCondition> {
    const instance = await this.content();

    const matchingCon = instance.conditions.find((con) => con.name === name);

    if (!matchingCon) {
      throw OperationFailed.condition("Condition does not exist");
    }

    return matchingCon;
  }

  /**
   * Remove a cart condition
   */
  public async removeCondition(name: string): Promise<void> {
    const instance = await this.content();
    const matchingConIndex = instance.conditions.findIndex(
      (con) => con.name === name
    );

    if (matchingConIndex < 0) {
      throw OperationFailed.condition("Condition not found");
    }

    // Remove condition at index
    instance.conditions.splice(matchingConIndex, 1);

    await this._loader.set(this.compute(instance) as any);
  }

  /**
   * Clear cart conditions
   */
  public async clearConditions(): Promise<void> {
    const instance = await this.content();
    instance.conditions = [];
    await this._loader.set(this.compute(instance) as any);
  }

  /**
   * Check if cart is empty
   */
  public async empty(): Promise<boolean> {
    return !(await this.count());
  }

  /**
   * Count number of items in cart
   */
  public async count(): Promise<number> {
    return (await this.items()).length;
  }

  /**
   * Get cart contents
   */
  public async content(): Promise<CartContent> {
    const data = {
      items: [],
      conditions: [],
      subtotal: 0,
      total: 0,
      ...((await this._loader.get()) as any)
    };
    return data as CartContent;
  }

  /**
   * List cart items
   */
  public async items(): Promise<Array<CartItem>> {
    const instance = await this.content();
    return instance.items;
  }

  /**
   * Get cart subtotal
   */
  public async subtotal(): Promise<number> {
    const instance = await this.content();
    return instance.subtotal;
  }

  /**
   * Get cart total
   */
  public async total(): Promise<number> {
    const instance = await this.content();
    return instance.total;
  }

  /**
   * Clear cart contents
   * @param {boolean} options.conditions
   * @param {boolean} options.data
   */
  public async clear(options: { conditions?: boolean, data?: boolean } = {}): Promise<void> {
    const instance = await this.content();
    instance.items = [];
    options = { conditions: true, data: true, ...options }
    if(options.conditions) instance.conditions = [];
    if(options.data) instance.data = {};
    await this._loader.set(this.compute(instance) as any);
  }

  /**
   * Get or put miscellaneous data
   */
  public async data<K extends string | Record<string, unknown>, V>(
    key?: K,
    value?: V
  ): Promise<V extends string ? V : K> {
    if (value !== undefined) {
      this._loader.set(`data.${key}`, value);
    } else if (typeof key === "string") {
      value = (await this._loader.get(`data.${key}`)) as V;
    } else if (key !== undefined) {
      await this._loader.set("data", key);
      value = key as any;
    } else {
      value = (await this._loader.get("data")) as any;
    }

    return value as any;
  }

  /**
   * Generic async for each
   */
  private async asyncForEach<T>(
    array: T[],
    callback: (item: T, index: number, allItems: T[]) => any
  ): Promise<any> {
    let arrayItems: Array<any> = [];
    for (let index = 0; index < array.length; index++) {
      arrayItems.push(await callback(array[index], index, array));
    }
    return arrayItems;
  }

  /**
   * Set current working driver
   * @param driver
   */
  public driver(driver: string): Cart {
    this._loader.driver(driver);
    return this;
  }

  /**
   * Register a custom driver.
   */
  public registerDriver<T extends Storage>(
    name: string,
    storage: StorageConstructor<T>
  ): void {
    this._loader.registerDriver(name, storage);
  }

  /**
   * Get the storage instance
   */
  public storage<T extends Storage = Storage>(name?: string): T {
    return this._loader.storage(name);
  }

  /**
   * Copy cart as return new instance
   * @param {string} session
   * @param {boolean} options.conditions
   * @param {boolean} options.data
   * @param {CartConfig} config
   */
  public async copy(
    session: string,
    options: { conditions?: boolean, data?: boolean } = {},
    config?: CartConfig
  ): Promise<Cart> {
    const instance = await this.content();
    const cart = new Cart(session, config || this._config);
    await cart.add(instance.items);
    options = { conditions: true, data: true, ...options }
    if (options.conditions) await cart.apply(instance.conditions);
    if (options.data) await cart.data(instance.data);
    return cart;
  }

  /**
   * Get the data loader
   */
  public loader(): DataLoader {
    return this._loader;
  }
}
