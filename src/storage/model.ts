import winston from "winston";

import {
  BaseEntity,
  Column,
  Index,
  Entity,
  ObjectId,
  ObjectIdColumn,
} from "typeorm";
import { ChainId, SignedVaa } from "@certusone/wormhole-sdk";
import { ParsedVaaWithBytes, Environment, RelayJob, fetchVaaHash } from "@wormhole-foundation/relayer-engine";

export enum RelayStatus {
  REDEEMED = "redeemed",
  FAILED = "failed",
  WAITING = "waiting",
  ACTIVE = "inprogress",
}

export type UserMetadata = Record<string, any>;

/**
 * Entity handler is used as a class that centralized mapping in and out of the database.
 * It will be passed by the user in case they need to use a different model to store relay data.
 * 
 * it contains:
 *   - the entity model to be used (needs to comply with MinimalRelayEntity interface below)
 *   - a method to map a vaa to a storage document
 *   - a method to map a storage document to an api response
 */
export interface EntityHandler<T extends abstract new (...args: any[]) => any> {
  entity: T;
  mapToStorageDocument(vaa: ParsedVaaWithBytes, job: RelayJob, logger?: winston.Logger): any;
  mapToApiResponse(entityObject: InstanceType<T>): any;
}

export class DefaultEntityHandler implements EntityHandler<typeof DefaultRelayEntity> {
  public entity = DefaultRelayEntity;

  public async mapToStorageDocument(vaa: ParsedVaaWithBytes, job: RelayJob, logger?: winston.Logger): Promise<DefaultRelayEntity> {
    // Question for the code reviewer: should we have our own implementation of fetchVaaHash? does it make sense to use 
    // the same implementation as the relayer-engine?
    const txHash = await fetchVaaHash(
      vaa.emitterChain,
      vaa.emitterAddress,
      vaa.sequence,
      logger, // TODO proper logging
      Environment.TESTNET, // TODO proper environment
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
      maxAttempts: job?.maxAttempts,
    });

    return relay;
  }

  public async mapToApiResponse(entityObject: InstanceType<typeof DefaultRelayEntity>) {
    // 
  }
}

/**
 * The minimal data that can be collected for a relay.
 * Any entity to be used with the relayer-status api should at least implement
 * this basic properties
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

  // Vaa basic info (required for any model):
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  emitterChain: ChainId;

  @Column()
  emitterAddress: string;

  @Column()
  sequence: string;

  @Column()
  fromAddress: string;

  @Column()
  toAddress: string;


  @Column()
  status: RelayStatus;

  @Column()
  @Index()
  fromTxHash: string;

  @Column()
  toTxHash: string;

  @Column()
  toWrappedAssetAddress: string;

  @Column()
  symbol: string;

  @Column()
  amountTransferred: string;

  @Column()
  amountToSwap: string;

  @Column()
  estimatedNativeAssetAmount: string;

  @Column()
  nativeAssetReceived: string;

  @Column()
  feeAmount: string;

  @Column()
  errorMessage: string;

  @Column()
  gasUsed: string;

  @Column()
  attempts: number;

  @Column()
  maxAttempts: number;

  @Column()
  gasPrice: string;

  @Column()
  vaa: SignedVaa;

  @Column()
  receivedAt: Date;

  @Column()
  completedAt: Date;

  @Column()
  failedAt: Date;

  @Column()
  toChain: ChainId;

  @Column()
  addedTimes: number;

  @Column()
  metadata: UserMetadata
}
