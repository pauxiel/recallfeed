## Rust: ownership in one rule

**Every value has exactly one owner, and the value is dropped when the owner goes out of scope.** Passing a value by move transfers ownership; borrowing with `&` or `&mut` lends it without transferring.

```rust
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}
```

The lifetime `'a` says the result lives no longer than the shorter-lived input. It describes a relationship the compiler checks. It does not change how long anything lives.

## Rust: errors as values

**Return `Result` and use `?` to bubble errors up.** A function that can fail says so in its type, and the caller must decide what to do. Reserve `panic!` for bugs, not for expected failures such as bad input.

```rust
fn read_port(raw: &str) -> Result<u16, std::num::ParseIntError> {
    let port: u16 = raw.trim().parse()?;
    Ok(port)
}
```

## TypeScript: parse, don't validate

**Turn unknown input into a precise type once, at the boundary.** A function that returns `boolean` for "is this valid" leaves the caller holding the same loose type. One that returns the narrowed type, or throws, lets the compiler enforce what you checked.

```ts
type Port = number & { readonly brand: "Port" };

function parsePort(value: unknown): Port {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new RangeError("not a valid port");
  }
  return value as Port;
}
```

## TypeScript: discriminated unions

**Give each variant a literal `kind`, and `switch` on it.** The compiler then knows which fields exist in each branch, and an unhandled variant becomes a type error once you add an exhaustiveness check.

```ts
type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rect": return shape.width * shape.height;
  }
}
```
