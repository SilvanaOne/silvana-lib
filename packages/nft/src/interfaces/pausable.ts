import { SmartContract, Field, Struct, Bool } from "o1js";
export { PausableContract, PauseEvent };

/**
 * The **PausableContract** interface provides a mechanism to dynamically enable or disable
 * certain functionalities within smart contracts. It extends the `SmartContract` class
 * and introduces methods that allow a contract to be paused and resumed, which is crucial
 * for managing emergencies, upgrades, or maintenance periods.
 *
 * By implementing the PausableContract interface, contracts gain greater control over their
 * operational states, enhancing security and flexibility in response to various scenarios.
 */
type PausableContract = SmartContract & {
  /**
   * Pauses the contract, potentially halting critical operations to protect against
   * unforeseen issues or to perform maintenance. When called, the contract enters a paused
   * state where certain functions are restricted.
   *
   * @returns A promise that resolves when the contract has been successfully paused.
   */
  pause(): Promise<void>;

  /**
   * Resumes the contract's operations after it has been paused. This method restores
   * the contract to its normal working state, allowing all functionalities to be accessible again.
   *
   * @returns A promise that resolves when the contract has been successfully resumed.
   */
  resume(): Promise<void>;
};

/**
 * The **PauseEvent** class represents an event emitted whenever the contract is paused or resumed.
 * This event contains the `isPaused` boolean field, indicating the current state of the contract.
 */
class PauseEvent extends Struct({
  /**
   * Indicates whether the contract is currently paused.
   */
  isPaused: Bool,
}) {}
