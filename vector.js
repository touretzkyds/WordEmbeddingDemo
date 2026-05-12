// Simple Vector class, extending built-in Arrays
class Vector extends Array {
    constructor(data) {
        if (Array.isArray(data)) {
            super(data.length);
            for (let i = 0; i < data.length; i++) this[i] = data[i];
        } else {
            super(data);
        }
    }

    // Inherited methods like .map(), .slice(), .filter() return plain Arrays
    static get [Symbol.species]() { return Array; }

    add(other) {
        const len = this.length;
        const r = new Array(len);
        for (let i = 0; i < len; i++) r[i] = this[i] + other[i];
        return new Vector(r);
    }

    sub(other) {
        const len = this.length;
        const r = new Array(len);
        for (let i = 0; i < len; i++) r[i] = this[i] - other[i];
        return new Vector(r);
    }

    mul(other) {
        const len = this.length;
        const r = new Array(len);
        for (let i = 0; i < len; i++) r[i] = this[i] * other[i];
        return new Vector(r);
    }

    sum() {
        let s = 0;
        for (let i = 0; i < this.length; i++) s += this[i];
        return s;
    }

    scale(s) {
        const len = this.length;
        const r = new Array(len);
        for (let i = 0; i < len; i++) r[i] = s * this[i];
        return new Vector(r);
    }

    dot(other) {
        let s = 0;
        for (let i = 0; i < this.length; i++) s += this[i] * other[i];
        return s;
    }

    norm() {
        let s = 0;
        for (let i = 0; i < this.length; i++) s += this[i] * this[i];
        return Math.sqrt(s);
    }

    unit() {
        const len = this.length;
        let s = 0;
        for (let i = 0; i < len; i++) s += this[i] * this[i];
        const inv = 1 / Math.sqrt(s);
        const r = new Array(len);
        for (let i = 0; i < len; i++) r[i] = this[i] * inv;
        return new Vector(r);
    }
}
