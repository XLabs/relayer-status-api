import winston from "winston";

import {
  BaseEntity,
  Column,
  Entity,
  Index,
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


export interface EntityHandler {
  entity: typeof BaseEntity;
  mapToStorageDocument(vaa: ParsedVaaWithBytes, job: RelayJob): any;
  mapToApiResponse(entityObject: BaseEntity): any;
}

export class DefaultEntityHandler implements EntityHandler {
  public entity: typeof DefaultRelayEntity;
  public async mapToStorageDocument(vaa: ParsedVaaWithBytes, job: RelayJob): Promise<DefaultRelayEntity> {
  // Question for the code reviewer: should we have our own implementation of fetchVaaHash? does it make sense to use 
  // the same implementation as the relayer-engine?
  const txHash = await fetchVaaHash(
    vaa.emitterChain,
    vaa.emitterAddress,
    vaa.sequence,
    new winston.Logger(), // TODO proper logging
    Environment.TESTNET, // TODO proper environment
  );

  const { emitterChain, emitterAddress, sequence } = vaa.id;

  const relay = new DefaultRelayEntity({
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

  public async mapToApiResponse(entityObject: DefaultRelayEntity) {
    // 
  }
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

  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  emitterChain: ChainId;

  @Column()
  emitterAddress: string;

  @Column()
  fromAddress: string;

  @Column()
  toAddress: string;

  @Column()
  sequence: string;

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
