import winston from "winston";

import { BaseEntity, Column, Index, Entity, ObjectId, ObjectIdColumn } from "typeorm";
import { ChainId, SignedVaa } from "@certusone/wormhole-sdk";
import { ParsedVaaWithBytes, Environment, RelayJob, fetchVaaHash } from "@wormhole-foundation/relayer-engine";
import { pick } from "../utils";

let silentLogger: winston.Logger;

export enum RelayStatus {
  REDEEMED = "redeemed",
  FAILED = "failed",
  WAITING = "waiting",
  ACTIVE = "inprogress"
}

export type UserMetadata = Record<string, any>;

/**
 * Entity handler is used as a class that centralizes mapping in and out of the database.
 * A class complying with this interface can be passed to the apis (write & read) to fully
 * customize the database entity and how it's handled.
 *
 * it contains:
 *   - the entity model to be used (needs to comply with MinimalRelayEntity interface below)
 *   - a method to map a vaa to a storage document
 *   - a method to map a storage document to an api response
 */
export interface EntityHandler<T extends abstract new (...args: any[]) => any> {
  entity: T;
  properties: string[];
  mapToStorageDocument(vaa: ParsedVaaWithBytes, job: RelayJob, environment: Environment, logger?: winston.Logger): any;
  mapToApiResponse(entityObject: InstanceType<T>): any;
  list(query: Partial<T>, limit: number): Promise<InstanceType<T>[]>;
}

export class DefaultEntityHandler implements EntityHandler<typeof DefaultRelayEntity> {
  public entity = DefaultRelayEntity;
  public properties: string[] = [
    "emitterChain",
    "emitterAddress",
    "sequence",
    "vaa",
    "fromTxHash",
    "status",
    "addedTimes",
    "attempts",
    "maxAttempts",
    "receivedAt",
    "completedAt",
    "failedAt",
    "errorMessage",
    "toTxHash",
    "metadata"
  ];

  public async mapToStorageDocument(
    vaa: ParsedVaaWithBytes,
    job: RelayJob,
    environment: Environment,
    logger?: winston.Logger
  ): Promise<DefaultRelayEntity> {
    // Question for the code reviewer: should we have our own implementation of fetchVaaHash? does it make sense to use
    // the same implementation as the relayer-engine?
    const txHash = await fetchVaaHash(
      vaa.emitterChain,
      vaa.emitterAddress,
      vaa.sequence,
      logger ? logger : (silentLogger ??= winston.createLogger({ silent: true })),
      environment
    );

    const { emitterChain, emitterAddress, sequence } = vaa.id;

    const relay = new this.entity({
      emitterChain: emitterChain,
      emitterAddress: emitterAddress,
      sequence: sequence,
      vaa: vaa.bytes,
      status: RelayStatus.WAITING,
      receivedAt: new Date(),
      fromTxHash: txHash,
      attempts: 0,
      addedTimes: 1,
      maxAttempts: job?.maxAttempts
    });

    return relay;
  }

  /**
   * This method provides a way to customize the api response by using an overriden method in a subclass.
   * Right now I see no need to map or response in any particular way.
   */
  public async mapToApiResponse(entityObject: InstanceType<typeof DefaultRelayEntity>) {
    return entityObject;
  }

  list(query: Partial<typeof DefaultRelayEntity>, limit: number): Promise<DefaultRelayEntity[]> {
    return this.entity.find({
      where: pick(query, this.properties),
      take: limit,
      order: { emitterChain: "ASC", emitterAddress: "ASC", sequence: "DESC" }
    });
  }
}

/**
 * The minimal data that can be collected for a relay.
 * Any entity to be used with the relayer-status api should at least implement
 * this basic properties.
 * This properties will  be automatically updated for relays by the
 * the relayer-status-api lib and will be available for every relay out of the box.
 */
export interface MinimalRelayEntity extends BaseEntity {
  // Vaa base data:
  _id: ObjectId;
  emitterChain: ChainId;
  emitterAddress: string;
  sequence: string;
  vaa: SignedVaa;
  fromTxHash: string;

  // Vaa processing data:
  status: RelayStatus;
  addedTimes: number;
  attempts: number;
  maxAttempts: number;

  receivedAt: Date;
  completedAt: Date;
  failedAt: Date;

  errorMessage: string;

  toTxHash: string;
  metadata: UserMetadata;
}

@Entity()
@Index(["emitterChain", "emitterAddress", "sequence"], { unique: true })
export class DefaultRelayEntity extends BaseEntity {
  constructor(props?: Partial<DefaultRelayEntity>) {
    super();
    if (props) {
      Object.assign(this, props);
    }
  }

  /**
   * This data is automatically mantained by the relayer-status-api lib
   * and will be available for every relay out of the box:
   */

  // Vaa basic info:
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  emitterChain: ChainId;

  @Column()
  emitterAddress: string;

  @Column()
  sequence: string;

  @Column()
  vaa: SignedVaa;

  @Column()
  @Index()
  fromTxHash: string;

  // Vaa Status Info:
  @Column()
  status: RelayStatus;

  @Column()
  addedTimes: number;

  @Column()
  attempts: number;

  @Column()
  maxAttempts: number;

  @Column()
  receivedAt: Date;

  @Column()
  completedAt: Date;

  @Column()
  failedAt: Date;

  @Column()
  errorMessage: string;

  /**
   * This data is not directly accessible to the relayer engine
   * and needs to be updated by the user of the relayer-status-api
   * by calling storedRelay.addMetadata or storedRelay.setTargetTxHash methods
   */
  @Column()
  toTxHash: string;

  @Column()
  metadata: UserMetadata;
}
