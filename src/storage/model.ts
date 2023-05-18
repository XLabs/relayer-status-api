import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from "typeorm";
import { ChainId, SignedVaa } from "@certusone/wormhole-sdk";

export enum RelayStatus {
  REDEEMED = "redeemed",
  FAILED = "failed",
  WAITING = "waiting",
  ACTIVE = "inprogress",
}

export type UserMetadata = Record<string, any>;

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
