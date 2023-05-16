import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ObjectId,
  ObjectIdColumn,
} from "typeorm";
import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_GNOSIS,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_TERRA,
  ChainId,
  ParsedVaa,
  SignedVaa,
} from "@certusone/wormhole-sdk";
// import { RelayPoint } from "../relayer/relay-point.metrics";

export enum RelayStatus {
  REDEEMED = "redeemed",
  FAILED = "failed",
  WAITING = "waiting",
  ACTIVE = "inprogress",
}

const chainToNativeSymbol: Partial<Record<ChainId, string>> = {
  [CHAIN_ID_SOLANA]: "SOL",
  [CHAIN_ID_ETH]: "ETH",
  [CHAIN_ID_AVAX]: "AVAX",
  [CHAIN_ID_BSC]: "BNB",
  [CHAIN_ID_FANTOM]: "FTM",
  [CHAIN_ID_POLYGON]: "MATIC",
  [CHAIN_ID_CELO]: "CELO",
  [CHAIN_ID_ALGORAND]: "ALGO",
  [CHAIN_ID_ACALA]: "ACA",
  [CHAIN_ID_INJECTIVE]: "INJ",
  [CHAIN_ID_GNOSIS]: "GNO",
  [CHAIN_ID_MOONBEAM]: "GLMR",
  [CHAIN_ID_KLAYTN]: "KLAY",
  [CHAIN_ID_KARURA]: "KAR",
  [CHAIN_ID_TERRA]: "LUNA",
  [CHAIN_ID_SUI]: "SUI",
  [CHAIN_ID_NEAR]: "NEAR",
};

class RelayMetrics {
  @Column()
  waitingForWalletInMs: number;

  @Column()
  waitingForTxInMs: number;
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
  errorCode: number;

  @Column()
  gasUsed: string;

  @Column()
  attempts: number;

  @Column()
  maxAttempts: number;

  @Column()
  gasPrice: string;

  @Column()
  metrics: RelayMetrics;

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

  markRedeemed(txHash: string) {
    this.status = RelayStatus.REDEEMED;
    this.toTxHash = txHash;
    this.completedAt = new Date();
  }

  markRetrying(attempts: number) {
    this.status = RelayStatus.WAITING;
    this.attempts = attempts;
  }

  markFailed(errorMessage: string, errorCode: number) {
    this.status = RelayStatus.FAILED;
    this.failedAt = new Date();
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
  }
}
