import { Field, Scalar, Group, add, power, dot } from "./curve.js";
import { PoseidonConstants } from "./constants.js";

export function poseidonInitialState(): bigint[] {
  return Array(PoseidonConstants.stateSize).fill(0n);
}

export function poseidonUpdate([...state]: bigint[], input: bigint[]) {
  // special case for empty input
  const { rate } = PoseidonConstants;
  if (input.length === 0) {
    permutation(state);
    return state;
  }
  // pad input with zeros so its length is a multiple of the rate
  const n = Math.ceil(input.length / rate) * rate;
  input = input.concat(Array(n - input.length).fill(0n));
  // for every block of length `rate`, add block to the first `rate` elements of the state, and apply the permutation
  for (let blockIndex = 0; blockIndex < n; blockIndex += rate) {
    for (let i = 0; i < rate; i++) {
      state[i] = add(state[i], input[blockIndex + i]);
    }
    permutation(state);
  }
  return state;
}

export function hashMessage(
  message: { fields: bigint[] },
  publicKey: Group,
  r: Field
): Scalar {
  let { x, y } = publicKey;

  let input = append(message, { fields: [x, y, r] });
  return hashWithPrefix(packToFields(input));
}

type GenericHashInput<Field> = { fields?: Field[]; packed?: [Field, number][] };
type HashInput = GenericHashInput<Field>;
function append(input1: HashInput, input2: HashInput): HashInput {
  return {
    fields: (input1.fields ?? []).concat(input2.fields ?? []),
    packed: (input1.packed ?? []).concat(input2.packed ?? []),
  };
}

function packToFields({ fields = [], packed = [] }: HashInput) {
  if (packed.length === 0) return fields;
  const packedBits = [];
  let currentPackedField = 0n;
  let currentSize = 0;
  for (let [field, size] of packed) {
    currentSize += size;
    if (currentSize < 255) {
      currentPackedField = currentPackedField * (1n << BigInt(size)) + field;
    } else {
      packedBits.push(currentPackedField);
      currentSize = size;
      currentPackedField = field;
    }
  }
  packedBits.push(currentPackedField);
  return fields.concat(packedBits);
}

//const signaturePrefix = "CodaSignature*******";
const prefix = 240717916736854602989207148466022993262069182275n;
function salt() {
  return poseidonUpdate(poseidonInitialState(), [prefix]);
}

function hashWithPrefix(input: Field[]) {
  let init = salt();
  return poseidonUpdate(init, input)[0];
}

function permutation(state: bigint[]) {
  // special case: initial round constant
  const {
    hasInitialRoundConstant,
    stateSize,
    roundConstants,
    fullRounds,
    power: power_,
    mds,
  } = PoseidonConstants;
  let offset = 0;
  if (hasInitialRoundConstant) {
    for (let i = 0; i < stateSize; i++) {
      state[i] = add(state[i], roundConstants[0][i]);
    }
    offset = 1;
  }
  for (let round = 0; round < fullRounds; round++) {
    // raise to a power
    for (let i = 0; i < stateSize; i++) {
      state[i] = power(state[i], power_);
    }
    let oldState = [...state];
    for (let i = 0; i < stateSize; i++) {
      // multiply by mds matrix
      state[i] = dot(mds[i], oldState);
      // add round constants
      state[i] = add(state[i], roundConstants[round + offset][i]);
    }
  }
}
