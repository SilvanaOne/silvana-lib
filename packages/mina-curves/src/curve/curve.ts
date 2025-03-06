import { PallasConstants } from "./constants.js";

export {
  Field,
  Bool,
  Scalar,
  PublicKey,
  Signature,
  Group,
  publicKeyToGroup,
  scale,
  sub,
  isEven,
  equal,
  power,
  add,
  mul,
  sqrt,
  dot,
};

type Field = bigint;
type Bool = boolean;
type Group = { x: Field; y: Field };
type PublicKey = { x: Field; isOdd: Bool };
type Scalar = bigint;
type Signature = { r: Field; s: Scalar };
const projectiveZero = { x: 1n, y: 1n, z: 0n };

type GroupProjective = { x: bigint; y: bigint; z: bigint };
type PointAtInfinity = { x: bigint; y: bigint; infinity: true };
type FinitePoint = { x: bigint; y: bigint; infinity: false };
type GroupAffine = PointAtInfinity | FinitePoint;

/**
 * A non-zero point on the Pallas curve in affine form { x, y }
 */
const Group = {
  toProjective({ x, y }: Group): GroupProjective {
    return projectiveFromAffine({ x, y, infinity: false });
  },
  /**
   * Convert a projective point to a non-zero affine point.
   * Throws an error if the point is zero / infinity, i.e. if z === 0
   */
  fromProjective(point: GroupProjective): Group {
    let { x, y, infinity } = projectiveToAffine(point);
    if (infinity) throw Error("Group.fromProjective: point is infinity");
    return { x, y };
  },
};

const { p, a, b, twoadicRoot, twoadicity, oddFactor } = PallasConstants;

function mod(x: bigint, p: bigint) {
  x = x % p;
  if (x < 0) return x + p;
  return x;
}

function projectiveDoubleA0(g: GroupProjective, p: bigint) {
  if (g.z === 0n) return g;
  let X1 = g.x,
    Y1 = g.y,
    Z1 = g.z;
  if (Y1 === 0n) throw Error("projectiveDouble: unhandled case");
  // http://www.hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#doubling-dbl-2009-l
  // A = X1^2
  let A = mod(X1 * X1, p);
  // B = Y1^2
  let B = mod(Y1 * Y1, p);
  // C = B^2
  let C = mod(B * B, p);
  // D = 2*((X1+B)^2-A-C)
  let D = mod(2n * ((X1 + B) * (X1 + B) - A - C), p);
  // E = 3*A
  let E = 3n * A;
  // F = E^2
  let F = mod(E * E, p);
  // X3 = F-2*D
  let X3 = mod(F - 2n * D, p);
  // Y3 = E*(D-X3)-8*C
  let Y3 = mod(E * (D - X3) - 8n * C, p);
  // Z3 = 2*Y1*Z1
  let Z3 = mod(2n * Y1 * Z1, p);
  return { x: X3, y: Y3, z: Z3 };
}

function projectiveDoubleAminus3(g: GroupProjective, p: bigint) {
  if (g.z === 0n) return g;
  let X1 = g.x,
    Y1 = g.y,
    Z1 = g.z;
  if (Y1 === 0n) throw Error("projectiveDouble: unhandled case");

  // http://www.hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-3.html#doubling-dbl-2001-b
  // delta = Z1^2
  let delta = mod(Z1 * Z1, p);
  // gamma = Y1^2
  let gamma = mod(Y1 * Y1, p);
  // beta = X1*gamma
  let beta = mod(X1 * gamma, p);
  // alpha = 3*(X1-delta)*(X1+delta)
  let alpha = mod((X1 - delta) * (X1 + delta), p);
  alpha = alpha + alpha + alpha;
  // X3 = alpha^2-8*beta
  let X3 = mod(alpha * alpha - 8n * beta, p);
  // Z3 = (Y1+Z1)^2-gamma-delta
  let Z3 = mod((Y1 + Z1) * (Y1 + Z1) - gamma - delta, p);
  // Y3 = alpha*(4*beta-X3)-8*gamma^2
  let Y3 = mod(alpha * (4n * beta - X3) - 8n * gamma * gamma, p);
  return { x: X3, y: Y3, z: Z3 };
}

function projectiveDouble(g: GroupProjective, p: bigint, a: bigint) {
  if (a === 0n) return projectiveDoubleA0(g, p);
  if (a + 3n === p) return projectiveDoubleAminus3(g, p);
  throw Error(
    "Projective doubling is not implemented for general curve parameter a, only a = 0 and a = -3"
  );
}

function projectiveNeg({ x, y, z }: GroupProjective, p: bigint) {
  return { x, y: y === 0n ? 0n : p - y, z };
}

function projectiveAdd(
  g: GroupProjective,
  h: GroupProjective,
  p: bigint,
  a: bigint
) {
  if (g.z === 0n) return h;
  if (h.z === 0n) return g;
  let X1 = g.x,
    Y1 = g.y,
    Z1 = g.z,
    X2 = h.x,
    Y2 = h.y,
    Z2 = h.z;
  // http://www.hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#addition-add-2007-bl
  // Z1Z1 = Z1^2
  let Z1Z1 = mod(Z1 * Z1, p);
  // Z2Z2 = Z2^2
  let Z2Z2 = mod(Z2 * Z2, p);
  // U1 = X1*Z2Z2
  let U1 = mod(X1 * Z2Z2, p);
  // U2 = X2*Z1Z1
  let U2 = mod(X2 * Z1Z1, p);
  // S1 = Y1*Z2*Z2Z2
  let S1 = mod(Y1 * Z2 * Z2Z2, p);
  // S2 = Y2*Z1*Z1Z1
  let S2 = mod(Y2 * Z1 * Z1Z1, p);
  // H = U2-U1
  let H = mod(U2 - U1, p);
  // H = 0 <==> x1 = X1/Z1^2 = X2/Z2^2 = x2 <==> degenerate case (Z3 would become 0)
  if (H === 0n) {
    // if S1 = S2 <==> y1 = y2, the points are equal, so we double instead
    if (S1 === S2) return projectiveDouble(g, p, a);
    // if S1 = -S2, the points are inverse, so return zero
    if (mod(S1 + S2, p) === 0n) return projectiveZero;
    throw Error("projectiveAdd: invalid point");
  }
  // I = (2*H)^2
  let I = mod((H * H) << 2n, p);
  // J = H*I
  let J = mod(H * I, p);
  // r = 2*(S2-S1)
  let r = 2n * (S2 - S1);
  // V = U1*I
  let V = mod(U1 * I, p);
  // X3 = r^2-J-2*V
  let X3 = mod(r * r - J - 2n * V, p);
  // Y3 = r*(V-X3)-2*S1*J
  let Y3 = mod(r * (V - X3) - 2n * S1 * J, p);
  // Z3 = ((Z1+Z2)^2-Z1Z1-Z2Z2)*H
  let Z3 = mod(((Z1 + Z2) * (Z1 + Z2) - Z1Z1 - Z2Z2) * H, p);
  return { x: X3, y: Y3, z: Z3 };
}

function projectiveSub(
  g: GroupProjective,
  h: GroupProjective,
  p: bigint,
  a: bigint
) {
  return projectiveAdd(g, projectiveNeg(h, p), p, a);
}

function getProjectiveDouble(p: bigint, a: bigint) {
  if (a === 0n) return projectiveDoubleA0;
  if (a + 3n === p) return projectiveDoubleAminus3;
  throw Error(
    "Projective doubling is not implemented for general curve parameter a, only a = 0 and a = -3"
  );
}

function bigIntToBits(x: bigint) {
  if (x < 0n) {
    throw Error(`bigIntToBits: negative numbers are not supported, got ${x}`);
  }
  let bits: boolean[] = [];
  for (; x > 0n; x >>= 1n) {
    let bit = !!(x & 1n);
    bits.push(bit);
  }
  return bits;
}

function projectiveScale(
  g: GroupProjective,
  x: bigint | boolean[],
  p: bigint,
  a: bigint
) {
  let double = getProjectiveDouble(p, a);
  let bits = typeof x === "bigint" ? bigIntToBits(x) : x;
  let h = projectiveZero;
  for (let bit of bits) {
    if (bit) h = projectiveAdd(h, g, p, a);
    g = double(g, p);
  }
  return h;
}

function sub(g: GroupProjective, h: GroupProjective) {
  return projectiveSub(g, h, p, PallasConstants.a);
}
function scale(g: GroupProjective, s: bigint) {
  return projectiveScale(g, s, p, PallasConstants.a);
}

function projectiveFromAffine({
  x,
  y,
  infinity,
}: GroupAffine): GroupProjective {
  if (infinity) return projectiveZero;
  return { x, y, z: 1n };
}

function projectiveToAffine(g: GroupProjective): GroupAffine {
  let z = g.z;
  if (z === 0n) {
    // infinity
    return { x: 0n, y: 0n, infinity: true };
  } else if (z === 1n) {
    // already normalized affine form
    return { x: g.x, y: g.y, infinity: false };
  } else {
    let zinv = inverse(z, p)!; // we checked for z === 0, so inverse exists
    let zinv_squared = mod(zinv * zinv, p);
    // x/z^2
    let x = mod(g.x * zinv_squared, p);
    // y/z^3
    let y = mod(g.y * zinv * zinv_squared, p);
    return { x: x, y: y, infinity: false };
  }
}

// inverting with EGCD, 1/a in Z_p
function inverse(a: bigint, p: bigint) {
  a = mod(a, p);
  if (a === 0n) return undefined;
  let b = p;
  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;
  while (a !== 0n) {
    let q = b / a;
    let r = mod(b, a);
    let m = x - u * q;
    let n = y - v * q;
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  if (b !== 1n) return undefined;
  return mod(x, p);
}

function isEven(x: bigint) {
  return !(mod(x, p) & 1n);
}

function equal(x: bigint, y: bigint) {
  // We check if x and y are both in the range [0, p). If they are, can do a simple comparison. Otherwise, we need to reduce them to the proper canonical field range.
  let x_ = x >= 0n && x < p ? x : mod(x, p);
  let y_ = y >= 0n && y < p ? y : mod(y, p);
  return x_ === y_;
}

// modular exponentiation, a^n % p
function power(a: bigint, n: bigint) {
  a = mod(a, p);
  let x = 1n;
  for (; n > 0n; n >>= 1n) {
    if (n & 1n) x = mod(x * a, p);
    a = mod(a * a, p);
  }
  return x;
}

function add(x: bigint, y: bigint) {
  return mod(x + y, p);
}

function mul(x: bigint, y: bigint) {
  return mod(x * y, p);
}

function dot(x: bigint[], y: bigint[]) {
  let z = 0n;
  let n = x.length;
  for (let i = 0; i < n; i++) {
    z += x[i] * y[i];
  }
  return mod(z, p);
}

function sqrt(n_: bigint, p: bigint, Q: bigint, c: bigint, M: bigint) {
  // https://en.wikipedia.org/wiki/Tonelli-Shanks_algorithm#The_algorithm
  // variable naming is the same as in that link ^
  // Q is what we call `t` elsewhere - the odd factor in p - 1
  // c is a known primitive root of unity
  // M is the twoadicity = exponent of 2 in factorization of p - 1
  const n = mod(n_, p);
  if (n === 0n) return 0n;
  let t = power(n, (Q - 1n) >> 1n); // n^(Q - 1)/2
  let R = mod(t * n, p); // n^((Q - 1)/2 + 1) = n^((Q + 1)/2)
  t = mod(t * R, p); // n^((Q - 1)/2 + (Q + 1)/2) = n^Q
  while (true) {
    if (t === 1n) return R;
    // use repeated squaring to find the least i, 0 < i < M, such that t^(2^i) = 1
    let i = 0n;
    let s = t;
    while (s !== 1n) {
      s = mod(s * s, p);
      i = i + 1n;
    }
    if (i === M) return undefined; // no solution
    let b = power(c, 1n << (M - i - 1n)); // c^(2^(M-i-1))
    M = i;
    c = mod(b * b, p);
    t = mod(t * c, p);
    R = mod(R * b, p);
  }
}

function sqrt_internal(x: bigint) {
  return sqrt(x, p, oddFactor, twoadicRoot, twoadicity);
}

function negate(x: bigint) {
  return x === 0n ? 0n : mod(-x, p);
}

function publicKeyToGroup({ x, isOdd }: PublicKey): Group {
  const ySquared = add(mul(x, mul(x, x)), b);
  let y = sqrt_internal(ySquared);
  if (y === undefined) {
    throw Error("PublicKey.toGroup: not a valid group element");
  }
  if (isOdd !== !!(y & 1n)) y = negate(y);
  return { x, y };
}
