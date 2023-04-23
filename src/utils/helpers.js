import { web3 } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";
import { MintLayout, TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Buffer } from "buffer";

import {
  SystemProgram,
  Transaction,
  SYSVAR_SLOT_HASHES_PUBKEY,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

import { sendTransactions } from "./connection";

// CLI Properties Given to us
const CANDY_MACHINE_PROGRAM = new web3.PublicKey(
  process.env.REACT_APP_CANDY_MACHINE_PROGRAM_ID
);

const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
  process.env.REACT_APP_TOKEN_METADATA_PROGRAM_ID
);

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3.PublicKey(
  process.env.REACT_APP_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
);

const CIVIC = new anchor.web3.PublicKey(process.env.REACT_APP_CIVIC);

const toDate = (value) => {
  if (!value) {
    return;
  }

  return new Date(value.toNumber() * 1000);
};

const numberFormater = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatNumber = {
  format: (val) => {
    if (!val) {
      return "--";
    }

    return numberFormater.format(val);
  },
  asNumber: (val) => {
    if (!val) {
      return undefined;
    }

    return val.toNumber() / LAMPORTS_PER_SOL;
  },
};

const getAtaForMint = async (mint, buyer) => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );
};

const getNetworkExpire = async (gatekeeperNetwork) => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [gatekeeperNetwork.toBuffer(), Buffer.from("expire")],
    CIVIC
  );
};

const getNetworkToken = async (wallet, gatekeeperNetwork) => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [
      wallet.toBuffer(),
      Buffer.from("gateway"),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
      gatekeeperNetwork.toBuffer(),
    ],
    CIVIC
  );
};

async function awaitTransactionSignatureConfirmation(
  txid,
  timeout,
  connection,
  queryStatus = false
) {
  let done = false;
  let status = {
    slot: 0,
    confirmations: 0,
    err: null,
  };
  const subId = 0;
  status = await new Promise(async (resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      console.log("Rejecting for timeout...");
      reject({ timeout: true });
    }, timeout);

    while (!done && queryStatus) {
      // eslint-disable-next-line no-loop-func
      (async () => {
        try {
          const signatureStatuses = await connection.getSignatureStatuses([
            txid,
          ]);
          status = signatureStatuses && signatureStatuses.value[0];
          if (!done) {
            if (!status) {
              console.log("REST null result for", txid, status);
            } else if (status.err) {
              console.log("REST error for", txid, status);
              done = true;
              reject(status.err);
            } else if (!status.confirmations) {
              console.log("REST no confirmations for", txid, status);
            } else {
              console.log("REST confirmation for", txid, status);
              done = true;
              resolve(status);
            }
          }
        } catch (e) {
          if (!done) {
            console.log("REST connection error: txid", txid, e);
          }
        }
      })();
      await sleep(2000);
    }
  });

  //@ts-ignore
  try {
    await connection.removeSignatureListener(subId);
  } catch (e) {
    // ignore
  }
  done = true;
  console.log("Returning status", status);
  return status;
}

function createAssociatedTokenAccountInstruction(
  associatedTokenAddress,
  payer,
  walletAddress,
  splTokenMintAddress
) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

async function getCandyMachineState(wallet, candyMachineId, connection) {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });

  const getProgramState = async () => {
    const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM, provider);
    const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM, provider);
    const state = await program.account.candyMachine.fetch(candyMachineId);
    return [program, state];
  };

  const getCurrentBlockTime = async () => {
    const slot = await connection.getSlot();
    return (await connection.getBlockTime(slot)) ?? new Date().getTime() / 1000;
  };

  const [[program, state], currentBlockTime] = await Promise.all([
    getProgramState(),
    getCurrentBlockTime(),
  ]);
  const itemsAvailable = state.data.itemsAvailable.toNumber();
  const itemsRedeemed = state.itemsRedeemed.toNumber();
  const itemsRemaining = itemsAvailable - itemsRedeemed;
  const timeDiff = new Date().getTime() / 1000 - currentBlockTime;
  const goLiveDate =
    state.data.goLiveDate !== null ? state.data.goLiveDate + timeDiff : null;

  return {
    id: candyMachineId,
    program,
    state: {
      authority: state.authority,
      itemsAvailable,
      itemsRedeemed,
      itemsRemaining,
      isSoldOut: itemsRemaining === 0,
      isActive: false,
      isPresale: false,
      isWhitelistOnly: false,
      goLiveDate: state.data.goLiveDate,
      treasury: state.wallet,
      tokenMint: state.tokenMint,
      gatekeeper: state.data.gatekeeper,
      endSettings: state.data.endSettings,
      whitelistMintSettings: state.data.whitelistMintSettings,
      hiddenSettings: state.data.hiddenSettings,
      price: state.data.price,
      retainAuthority: state.data.retainAuthority,
    },
  };
}

async function getFreezePdaState(program, freezePda) {
  try {
    const state = await program.account.freezePda.fetch(freezePda);
    return state;
  } catch (error) {
    return null;
  }
}

const getMasterEdition = async (mint) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const getMetadata = async (mint) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

async function getCandyMachineCreator(candyMachine) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("candy_machine"), candyMachine.toBuffer()],
    CANDY_MACHINE_PROGRAM
  );
}

async function getFreezePda(candyMachine) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("freeze"), candyMachine.toBuffer()],
    CANDY_MACHINE_PROGRAM
  );
}

async function getCollectionPDA(candyMachineAddress) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("collection"), candyMachineAddress.toBuffer()],
    CANDY_MACHINE_PROGRAM
  );
}

async function getCollectionAuthorityRecordPDA(mint, newAuthority) {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("collection_authority"),
        newAuthority.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
}

const createAccountsForMint = async (candyMachine, payer) => {
  const mint = anchor.web3.Keypair.generate();
  const userTokenAccountAddress = (
    await getAtaForMint(mint.publicKey, payer)
  )[0];

  const signers = [mint];
  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports:
        await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
          MintLayout.span
        ),
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      payer,
      payer
    ),
    createAssociatedTokenAccountInstruction(
      userTokenAccountAddress,
      payer,
      payer,
      mint.publicKey
    ),
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccountAddress,
      payer,
      [],
      1
    ),
  ];

  return {
    mint: mint,
    userTokenAccount: userTokenAccountAddress,
    transaction: (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet,
        [instructions],
        [signers],
        "StopOnFailure",
        "singleGossip",
        () => {},
        () => false,
        undefined,
        [],
        []
      )
    ).txs[0].txid,
  };
};

const mint = async (
  candyMachine,
  payer,
  beforeTransactions = [],
  afterTransactions = [],
  setupState
) => {
  const mint = setupState?.mint ?? anchor.web3.Keypair.generate();
  const userTokenAccountAddress = (
    await getAtaForMint(mint.publicKey, payer)
  )[0];

  const userPayingAccountAddress = candyMachine.state.tokenMint
    ? (await getAtaForMint(candyMachine.state.tokenMint, payer))[0]
    : payer;

  const candyMachineAddress = candyMachine.id;
  const remainingAccounts = [];
  const instructions = [];
  const signers = [];
  console.log("SetupState: ", setupState);
  if (!setupState) {
    signers.push(mint);
    instructions.push(
      ...[
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports:
            await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
              MintLayout.span
            ),
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          mint.publicKey,
          0,
          payer,
          payer
        ),
        createAssociatedTokenAccountInstruction(
          userTokenAccountAddress,
          payer,
          payer,
          mint.publicKey
        ),
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          mint.publicKey,
          userTokenAccountAddress,
          payer,
          [],
          1
        ),
      ]
    );
  }

  if (candyMachine.state.gatekeeper) {
    remainingAccounts.push({
      pubkey: (
        await getNetworkToken(
          payer,
          candyMachine.state.gatekeeper.gatekeeperNetwork
        )
      )[0],
      isWritable: true,
      isSigner: false,
    });

    if (candyMachine.state.gatekeeper.expireOnUse) {
      remainingAccounts.push({
        pubkey: CIVIC,
        isWritable: false,
        isSigner: false,
      });
      remainingAccounts.push({
        pubkey: (
          await getNetworkExpire(
            candyMachine.state.gatekeeper.gatekeeperNetwork
          )
        )[0],
        isWritable: false,
        isSigner: false,
      });
    }
  }
  if (candyMachine.state.whitelistMintSettings) {
    const mint = new anchor.web3.PublicKey(
      candyMachine.state.whitelistMintSettings.mint
    );

    const whitelistToken = (await getAtaForMint(mint, payer))[0];
    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false,
    });

    if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false,
      });
      remainingAccounts.push({
        pubkey: payer,
        isWritable: false,
        isSigner: true,
      });
    }
  }

  if (candyMachine.state.tokenMint) {
    remainingAccounts.push({
      pubkey: userPayingAccountAddress,
      isWritable: true,
      isSigner: false,
    });
    remainingAccounts.push({
      pubkey: payer,
      isWritable: false,
      isSigner: true,
    });
  }
  const metadataAddress = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);

  const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(
    candyMachineAddress
  );

  const freezePda = (await getFreezePda(candyMachineAddress))[0];
  console.log(freezePda.toString());

  const freezePdaState = await getFreezePdaState(
    candyMachine.program,
    freezePda
  );

  console.log("Freeze state: ");
  console.log(freezePdaState);

  if (freezePdaState != null) {
    remainingAccounts.push({
      pubkey: freezePda,
      isWritable: true,
      isSigner: false,
    });
    remainingAccounts.push({
      pubkey: userTokenAccountAddress,
      isWritable: false,
      isSigner: false,
    });
    if (candyMachine.state.tokenMint != null) {
      const freezeAta = (
        await getAtaForMint(candyMachine.state.tokenMint, freezePda)
      )[0];
      remainingAccounts.push({
        pubkey: freezeAta,
        isWritable: true,
        isSigner: false,
      });
    }
  }

  console.log(remainingAccounts.map((rm) => rm.pubkey.toBase58()));
  instructions.push(
    await candyMachine.program.instruction.mintNft(creatorBump, {
      accounts: {
        candyMachine: candyMachineAddress,
        candyMachineCreator,
        payer: payer,
        wallet: candyMachine.state.treasury,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: payer,
        updateAuthority: payer,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      remainingAccounts:
        remainingAccounts.length > 0 ? remainingAccounts : undefined,
    })
  );

  const [collectionPDA] = await getCollectionPDA(candyMachineAddress);
  const collectionPDAAccount =
    await candyMachine.program.provider.connection.getAccountInfo(
      collectionPDA
    );

  if (collectionPDAAccount && candyMachine.state.retainAuthority) {
    try {
      const collectionData =
        await candyMachine.program.account.collectionPda.fetch(collectionPDA);
      console.log(collectionData);
      const collectionMint = collectionData.mint;
      const collectionAuthorityRecord = await getCollectionAuthorityRecordPDA(
        collectionMint,
        collectionPDA
      );
      console.log(collectionMint);
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint);
        const collectionMasterEdition = await getMasterEdition(collectionMint);
        console.log("Collection PDA: ", collectionPDA.toBase58());
        console.log("Authority: ", candyMachine.state.authority.toBase58());
        instructions.push(
          await candyMachine.program.instruction.setCollectionDuringMint({
            accounts: {
              candyMachine: candyMachineAddress,
              metadata: metadataAddress,
              payer: payer,
              collectionPda: collectionPDA,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              collectionMint,
              collectionMetadata,
              collectionMasterEdition,
              authority: candyMachine.state.authority,
              collectionAuthorityRecord,
            },
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  const instructionsMatrix = [instructions];
  const signersMatrix = [signers];

  try {
    const txns = (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet,
        instructionsMatrix,
        signersMatrix,
        "StopOnFailure",
        "singleGossip",
        () => {},
        () => false,
        undefined,
        beforeTransactions,
        afterTransactions
      )
    ).txs.map((t) => t.txid);
    const mintTxn = txns[0];
    return {
      mintTxId: mintTxn,
      metadataKey: metadataAddress,
    };
  } catch (e) {
    console.log(e);
  }
  return null;
};

const shortenAddress = (address, chars = 4) => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export {
  CANDY_MACHINE_PROGRAM,
  TOKEN_METADATA_PROGRAM_ID,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  CIVIC,
  toDate,
  formatNumber,
  getAtaForMint,
  getNetworkExpire,
  getNetworkToken,
  createAssociatedTokenAccountInstruction,
  mint,
  shortenAddress,
  createAccountsForMint,
  getCollectionAuthorityRecordPDA,
  getCollectionPDA,
  getFreezePda,
  getCandyMachineCreator,
  getFreezePdaState,
  getCandyMachineState,
  awaitTransactionSignatureConfirmation,
};
