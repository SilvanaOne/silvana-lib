import { Field, Provable, UInt64, Gadgets, Struct } from "o1js";

export class MulDivResult extends Struct({
  result: UInt64,
  remainder: UInt64,
}) {}

class MulDivResultInternal extends Struct({
  result: Field,
  remainder: Field,
}) {}

export function mulDiv(params: {
  value: UInt64;
  multiplier: UInt64;
  denominator: UInt64;
}): MulDivResult {
  const { value, multiplier, denominator } = params;
  denominator.equals(UInt64.zero).assertFalse("division by zero"); // should fail in case the denominator is zero
  const fields = Provable.witness(MulDivResultInternal, () => {
    const valueBigInt = value.toBigInt();
    const multiplierBigInt = multiplier.toBigInt();
    const denominatorBigInt = denominator.toBigInt();
    // handle division by zero for first pass of the prover that can pass zero instead of the real value
    if (denominatorBigInt === 0n) {
      return { result: Field.from(0n), remainder: Field.from(0n) };
    }
    const result = (valueBigInt * multiplierBigInt) / denominatorBigInt;
    const remainder =
      valueBigInt * multiplierBigInt - result * denominatorBigInt;
    return { result: Field.from(result), remainder: Field.from(remainder) };
  });
  // We check that the result and remainder are in the correct range using Gadgets.rangeCheck64 before using Unsafe methods
  // The next four lines should always be used together and cannot be separated
  Gadgets.rangeCheck64(fields.result);
  const result = UInt64.Unsafe.fromField(fields.result);
  Gadgets.rangeCheck64(fields.remainder);
  const remainder = UInt64.Unsafe.fromField(fields.remainder);

  remainder.assertLessThan(denominator); // should fail in case the denominator is zero

  // We use the Field representations of the values to avoid overflows
  result.value
    .mul(denominator.value)
    .add(remainder.value)
    .assertEquals(value.value.mul(multiplier.value)); // should fail in case the denominator is zero
  return {
    result,
    remainder,
  };
}
