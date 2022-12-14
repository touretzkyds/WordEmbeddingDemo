// Simple Vector class, extending built-in Arrays
class Vector extends Array {
    // unpack if Array is passed in, otherwise just use Array constructor
    constructor(...args) {
        (args.length === 1 && Array.isArray(args[0]))
            ? super(...args[0])
            : super(...args);
    }

    add(other) {
        return this.map((e, i) => e + other[i]);
    }

    sub(other) {
        return this.map((e, i) => e - other[i]);
    }

    mul(other) {
        return this.map((e, i) => e * other[i]);
    }

    sum() {
        return this.reduce((a, b) => a+b);
    }

    scale(s) {
        return this.map(e => s*e);
    }

    dot(other) {
        return this.mul(other).sum();
    }

    norm() {
        return Math.sqrt(this.dot(this));
    }

    unit() {
        return this.scale(1 / this.norm());
    }
}
