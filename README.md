# @timbouc/cart

A Shopping Cart Implementation for Node.js and browsers.

:yellow_heart: **Features**

* Pluggable storage drivers
* Manage vouchers, shipping and other conditional factors with Conditions
* Sync frontend and backend instances with remote storage connection
* Comes with a default local storage (Node.js)
* Save miscellaneous data to cart (e.g. currency, purchase metadata)
* Customise final *items'* and *conditions'* prices with `hooks` for complex (e.g. graduated pricing) use case



## Getting Started

This package is available in the npm registry.
It can easily be installed with `npm` or `yarn`.

```bash
$ npm i @timbouc/cart
# or
$ yarn add @timbouc/cart
```

**Instantiate with a [configuration](examples/config.ts).**

```javascript
import { Cart } from '@timbouc/cart';
const cart = new Cart(context.uudid, config);
```



## Usage

```typescript
const item = await cart.add({
    id: product.id,
    name: product.name,
    price: product.price,
});
await cart.apply([
    {
        name: 'Voucher 1',
        type: 'voucher',
        target: item.item_id,
        value: '-10%', // removes 10% of the value of product.price
    },
    {
        name: 'Shipping',
        type: 'shipping',
        target: 'subtotal', // add 10 to subtotal
        value: 10,
    }
]);

const subtotal = await cart.subtotal(),
      total = await cart.total();
```

### Registering Storage

```typescript
const { RedisStorage, PostgresStorage } from './StorageDrivers';

const session = context.uudid
const cart = new Cart(session, config)
cart.registerDriver('redis', RedisStorage)
cart.registerDriver('pg', PostgresStorage())

// use redis storage for different shopping carts
cart.driver('redis')
	.add(...)

// use postgres storage for wishlist
cart.driver('pg')
    .session(session + ':wishlist') // can also change session (user)
	.add(...)
```

See [RedisStorage example](examples/RedisStorage.ts) from custom storage.



### Response interface

Asynchronous methods will always return a Promise which resolves with a `Response`
object.



### Methods

<details>
<summary markdown="span"><code>session(session: string): Cart</code></summary>

```javascript
// Set/switch cart session instance
cart.session(user_id)
    .add(...)
```
</details>

<details>
<summary markdown="span"><code>add(item: CartInputItem|Array&lt;CartInputItem&gt;): Promise&lt;CartItem|Array<CartItem>&gt;</code></summary>

Add an item or an array of items to cart

```javascript
// add one item to cart
const item = await cart.add({
	// item_id: 1,        // Manually set item id
    id: product.id,
    name: product.name,
    price: product.price,
    quantity: 3, // defaults to one
    conditions: conditions as Array<CartCondition>,
    options: options as Array<CartItemOption>,
})

// add multiple items to cart
const [item1, item2] = await cart.add([
    {
        id: product1.id,
        name: product1.name,
        price: product1.price,
        options: [{
            name: "Color",
            value: "pink",
        }]
    },
    {
        id: product2.id,
        name: product2.name,
        price: product2.price,
    },
])

// Add item with custom field(s)
// cannot be updated afterwords
const item = await cart.add({
    id: product.id,
    name: product.name,
    price: product.price,
    workspace: 'Timbouc',
})
```

</details>

<details>
<summary markdown="span"><code>update(item_id: number|string, options: object): Promise&lt;CartItem&gt;</code></summary>

Update a cart item. Accumulates quantity by default but override can be specified

```typescript
// new item price, price can also be a string format like so: '98.67'
cart.update(456, {
    name: 'New Item Name',
    price: 99.99,
});

// update a product's quantity
cart.update(456, {
    quantity: 2, // if the current product has a quantity of 4, another 2 will be added so this will result to 6
});

// update a product by reducing its quantity
cart.update(456, {
    quantity: -1, // if the current product has a quantity of 4, another 2 will be subtracted so this will result to 3
});

// NOTE: By default the quantity update is relative to its current value.
// To totally replace the quantity instead of incrementing or decrementing its current quantity value
// pass an object
cart.update(456, {
    quantity: {
        relative: false,
        value: 5
    }
});
```

</details>

<details>
<summary markdown="span"><code>remove(item_id: number | string | Array&lt;string|number&gt;): Promise&lt;CartContent&gt;</code></summary>

Remove an item or an array of items from cart

```typescript
cart.remove(456);

```

</details>

<details>
<summary markdown="span"><code>get(item_id: number | string): Promise&lt;CartItem&gt;</code></summary>

```javascript
// Get cart item
const item = await cart.get(item_id);
```
</details>

<details>
<summary markdown="span"><code>apply(condition: CartCondition | Array&lt;CartCondition&gt;): Promise&lt;CartCondition | Array&lt;CartCondition&gt;&gt;</code></summary>

Apply a cart condition or an array of conditions. Conditions are used to account for discounts, taxes and other conditional factors.
The field `target` specifies the entity the condition applies to. This value can be `total`, `subtotal` or an item ID.

```javascript
const voucher1 = await cart.apply({
    name: 'Voucher 1',
    type: 'voucher',
    target: 1,  // cart item id
    value: -10, // removes the value `10` from i1
});

// apply multiple conditions
const [voucher1b, tax] = await cart.apply([
    {
        name: 'Voucher 1', // Replaces `Voucher 1` as it already exists (handy for managing tax, shipping and other standard conditions)
        type: 'voucher',
        target: 2,  // cart item id
        value: '-10%', // removes 10% of the value of item 2
    },
    {
        name: 'Tax',
        type: 'tax',
        target: 'subtotal',
        value: '10%', // adds 10% of subtotal to total
    }
]);
```

</details>

<details>
<summary markdown="span"><code>conditions(): Promise&lt;Array&lt;CartCondition&gt;&gt;</code></summary>

```javascript
// List cart conditions
await cart.conditions()
```
</details>

<details>
<summary markdown="span"><code>condition(name: string): Promise&lt;CartCondition&gt;</code></summary>

```javascript
// Get condition
await cart.condition('Voucher 2')
```
</details>

<details>
<summary markdown="span"><code>removeCondition(name: string): Promise&lt;Boolean&gt;</code></summary>

```javascript
// Remove condition
await cart.removeCondition('Voucher 2')
```
</details>

<details>
<summary markdown="span"><code>clearConditions(): Promise&lt;Boolean&gt;</code></summary>

```javascript
// Clear all cart conditions
await cart.clearConditions()
```
</details>

<details>
<summary markdown="span"><code>data(key?: string, value?: any): Promise&lt;any&gt;</code></summary>


```javascript
// Save currency. Returns `AUD`
let d1 = await cart.data('currency', 'AUD')

// Get saved data
let d2 = await cart.data('currency')

// Use dot notation
await cart.data('customer.name', 'Johnn Doe')
await cart.data('customer.email', 'johndoe@mail.com')
await cart.data('customer') // returns { name: 'Johnn Doe', email: 'johndoe@mail.com' }
await cart.data() // returns { currency: 'AUD', customer: { name: 'Johnn Doe', email: 'johndoe@mail.com' } }
```
</details>

<details>
<summary markdown="span"><code>empty(): Promise&lt;Boolean&gt;</code></summary>

```javascript
// If cart is empty
await cart.empty()
```
</details>

<details>
<summary markdown="span"><code>count(): Promise&lt;number&gt;</code></summary>

```javascript
// Count item entries in cart
await cart.count()
```
</details>

<details>
<summary markdown="span"><code>content(): Promise&lt;CartContent&gt;</code></summary>

Return the cart content.

```javascript
// Get cart contents
await cart.content()
```
</details>

<details>
<summary markdown="span"><code>items(): Promise&lt;Array&lt;CartItem&gt;&gt;</code></summary>

```javascript
// List cart items
await cart.items()
```
</details>

<details>
<summary markdown="span"><code>subtotal(): Promise&lt;number&gt;</code></summary>

```javascript
// Get cart subtotal
await cart.subtotal()
```
</details>

<details>
<summary markdown="span"><code>total(): Promise&lt;number&gt;</code></summary>

```javascript
// Get cart total
await cart.total()
```
</details>

<details>
<summary markdown="span"><code>clear({ conditions: true, data: true }): Promise&lt;void&gt;</code></summary>

```javascript
await cart.clear()

// Do not clear conditions and data
await cart.clear({ conditions: false, data: false })
```
</details>

<details>
<summary markdown="span"><code>copy({ conditions: true, data: true }): Promise&lt;Cart&gt;</code></summary>

```javascript
const cart2 = await cart.copy(new_session_id)

// Do not copy conditions and data. Also pass a new config
const cart3 = await cart.copy(new_session_id, { conditions: false, data: false }, new_config)
```
</details>

<details>
<summary markdown="span"><code>storage&lt;T extends Storage = Storage&gt;(name?: string): T</code></summary>

```javascript
// Get the storage instance
const storage = cart.storage()
```
</details>

<details>
<summary markdown="span"><code>loader(): DataLoader</code></summary>

```javascript
// Get theunderlying data loader
const loader = cart.loader()
```
</details>

## Contribution Guidelines

Any pull requests or discussions are welcome.
Note that every pull request providing new feature or correcting a bug should be created with appropriate unit tests.
