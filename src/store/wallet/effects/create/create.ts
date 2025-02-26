import {
  BitpaySupportedCoins,
  BitpaySupportedEvmCoins,
  SupportedChains,
} from '../../../../constants/currencies';
import {Effect} from '../../../index';
import {Credentials} from 'bitcore-wallet-client/ts_build/lib/credentials';
import {BwcProvider} from '../../../../lib/bwc';
import merge from 'lodash.merge';
import {
  buildKeyObj,
  buildWalletObj,
  checkEncryptPassword,
  mapAbbreviationAndName,
} from '../../utils/wallet';
import {
  failedAddWallet,
  successAddWallet,
  successCreateKey,
} from '../../wallet.actions';
import API from 'bitcore-wallet-client/ts_build';
import {Key, KeyMethods, KeyOptions, Token, Wallet} from '../../wallet.models';
import {Network} from '../../../../constants';
import {BitpaySupportedTokenOptsByAddress} from '../../../../constants/tokens';
import {
  subscribeEmailNotifications,
  subscribePushNotifications,
} from '../../../app/app.effects';
import {
  dismissDecryptPasswordModal,
  showDecryptPasswordModal,
} from '../../../app/app.actions';
import {
  addTokenChainSuffix,
  getAccount,
  sleep,
} from '../../../../utils/helper-methods';
import {t} from 'i18next';
import {LogActions} from '../../../log';
import {IsERCToken, IsEVMChain, IsSegwitCoin} from '../../utils/currency';
import {createWalletAddress} from '../address/address';
import cloneDeep from 'lodash.clonedeep';
import {MoralisErc20TokenBalanceByWalletData} from '../../../moralis/moralis.types';
import {getERC20TokenBalanceByWallet} from '../../../moralis/moralis.effects';
import {getTokenContractInfo} from '../status/status';
import {addCustomTokenOption} from '../currencies/currencies';

export interface CreateOptions {
  network?: Network;
  account?: number;
  customAccount?: boolean;
  useNativeSegwit?: boolean;
  segwitVersion?: number;
  singleAddress?: boolean;
  walletName?: string;
  password?: string;
}

export interface AddWalletData {
  key: Key;
  currency: {
    chain: string;
    currencyAbbreviation: string;
    isToken?: boolean;
    tokenAddress?: string;
    decimals?: number;
    logo?: string;
  };
  associatedWallet?: Wallet;
  options: CreateOptions;
  context?: string;
}

const BWC = BwcProvider.getInstance();

export const startCreateKey =
  (
    currencies: Array<{
      chain: string;
      currencyAbbreviation: string;
      isToken: boolean;
      tokenAddress?: string;
    }>,
  ): Effect<Promise<Key>> =>
  async (dispatch, getState) => {
    return new Promise(async (resolve, reject) => {
      try {
        const state = getState();
        const network = state.APP.network;
        const keys = state.WALLET.keys;

        const _key = BWC.createKey({
          seedType: 'new',
        });

        const wallets = await dispatch(
          createMultipleWallets({
            key: _key,
            currencies,
            options: {
              network,
            },
          }),
        );

        const key = buildKeyObj({key: _key, wallets});
        dispatch(
          successCreateKey({
            key,
          }),
        );
        resolve(key);
      } catch (err) {
        const errstring =
          err instanceof Error ? err.message : JSON.stringify(err);
        dispatch(LogActions.error(`Error creating key: ${errstring}`));
        reject();
      }
    });
  };

/////////////////////////////////////////////////////////////

export const addWallet =
  ({
    key,
    currency,
    associatedWallet,
    options,
    context,
  }: AddWalletData): Effect<Promise<Wallet>> =>
  async (dispatch, getState): Promise<Wallet> => {
    return new Promise(async (resolve, reject) => {
      try {
        let newWallet;
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
          WALLET,
        } = getState();
        const tokenOptsByAddress = {
          ...BitpaySupportedTokenOptsByAddress,
          ...WALLET.tokenOptionsByAddress,
          ...WALLET.customTokenOptionsByAddress,
        };
        const {walletName} = options;

        if (currency.isToken) {
          if (!associatedWallet) {
            associatedWallet = (await dispatch(
              createWallet({
                key: key.methods!,
                coin: BitpaySupportedCoins[currency.chain].coin,
                chain: currency.chain as SupportedChains,
                options,
              }),
            )) as Wallet;

            const receiveAddress = (await dispatch<any>(
              createWalletAddress({wallet: associatedWallet, newAddress: true}),
            )) as string;
            dispatch(
              LogActions.info(`new address generated: ${receiveAddress}`),
            );
            associatedWallet.receiveAddress = receiveAddress;

            const {currencyAbbreviation, currencyName} = dispatch(
              mapAbbreviationAndName(
                associatedWallet.credentials.coin,
                associatedWallet.credentials.chain,
                undefined,
              ),
            );
            key.wallets.push(
              merge(
                associatedWallet,
                buildWalletObj(
                  {
                    ...associatedWallet.credentials,
                    currencyAbbreviation,
                    currencyName,
                  },
                  tokenOptsByAddress,
                ),
              ),
            );
          }

          if (currency.tokenAddress && currency.chain) {
            // Workaround to add a token that is not present in our tokenOptsByAddress as a custom token
            LogActions.debug(
              `Checking if tokenAddress: ${currency.tokenAddress} is present in tokenOptsByAddress...`,
            );
            const tokenChain = cloneDeep(currency.chain).toLowerCase();
            const tokenAdressWithChain = addTokenChainSuffix(
              currency.tokenAddress,
              tokenChain,
            );
            const currentTokenOpts = tokenOptsByAddress[tokenAdressWithChain];

            if (!currentTokenOpts) {
              LogActions.debug(
                'Token not present in tokenOptsByAddress. Creating custom token wallet...',
              );
              const opts = {
                tokenAddress: cloneDeep(currency.tokenAddress),
                chain: tokenChain,
              };

              let tokenContractInfo;
              try {
                tokenContractInfo = await getTokenContractInfo(
                  associatedWallet,
                  opts,
                );
              } catch (err) {
                LogActions.debug(
                  `Error in getTokenContractInfo for opts: ${JSON.stringify(
                    opts,
                  )}. Continue anyway...`,
                );
              }

              const customToken: Token = {
                symbol: tokenContractInfo?.symbol
                  ? tokenContractInfo.symbol.toLowerCase()
                  : cloneDeep(currency.currencyAbbreviation).toLowerCase(),
                name:
                  tokenContractInfo?.name ??
                  cloneDeep(currency.currencyAbbreviation).toUpperCase(),
                decimals: tokenContractInfo?.decimals
                  ? Number(tokenContractInfo.decimals)
                  : cloneDeep(Number(currency.decimals)),
                address: cloneDeep(currency.tokenAddress.toLowerCase()),
              };

              tokenOptsByAddress[tokenAdressWithChain] = customToken;
              dispatch(addCustomTokenOption(customToken, tokenChain));
            }
          }

          newWallet = (await dispatch(
            createTokenWallet(
              associatedWallet,
              currency.currencyAbbreviation.toLowerCase(),
              currency.tokenAddress!,
              tokenOptsByAddress,
            ),
          )) as Wallet;
        } else {
          newWallet = (await dispatch(
            createWallet({
              key: key.methods!,
              coin: currency.currencyAbbreviation,
              chain: currency.chain as SupportedChains,
              options,
              context,
            }),
          )) as Wallet;
        }

        if (!newWallet) {
          return reject();
        }
        newWallet.receiveAddress = associatedWallet?.receiveAddress;

        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(newWallet, brazeEid!));
        }
        // subscribe new wallet to email notifications
        if (
          emailNotifications &&
          emailNotifications.accepted &&
          emailNotifications.email
        ) {
          const prefs = {
            email: emailNotifications.email,
            language: defaultLanguage,
            unit: 'btc', // deprecated
          };
          dispatch(subscribeEmailNotifications(newWallet, prefs));
        }

        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            newWallet.credentials.coin,
            newWallet.credentials.chain,
            newWallet.credentials?.token?.address,
          ),
        );

        key.wallets.push(
          merge(
            newWallet,
            buildWalletObj(
              {
                ...newWallet.credentials,
                currencyAbbreviation,
                currencyName,
                walletName,
                isHardwareWallet: associatedWallet?.isHardwareWallet,
                hardwareData: associatedWallet?.hardwareData,
              },
              tokenOptsByAddress,
            ),
          ),
        );

        dispatch(successAddWallet({key}));
        dispatch(LogActions.info(`Added Wallet ${currencyName}`));
        resolve(newWallet);
      } catch (err) {
        const errstring =
          err instanceof Error ? err.message : JSON.stringify(err);
        dispatch(failedAddWallet());
        dispatch(LogActions.error(`Error adding wallet: ${errstring}`));
        reject(err);
      }
    });
  };

/////////////////////////////////////////////////////////////

const createMultipleWallets =
  ({
    key,
    currencies,
    options,
  }: {
    key: KeyMethods;
    currencies: Array<{
      chain: string;
      currencyAbbreviation: string;
      isToken: boolean;
      tokenAddress?: string;
    }>;
    options: CreateOptions;
  }): Effect<Promise<Wallet[]>> =>
  async (dispatch, getState) => {
    const {
      WALLET,
      APP: {
        notificationsAccepted,
        emailNotifications,
        brazeEid,
        defaultLanguage,
      },
    } = getState();
    const tokenOpts = {
      ...BitpaySupportedTokenOptsByAddress,
      ...WALLET.tokenOptionsByAddress,
      ...WALLET.customTokenOptionsByAddress,
    };
    const wallets: API[] = [];
    const tokens = currencies.filter(({isToken}) => isToken);
    const coins = currencies.filter(({isToken}) => !isToken);
    for (const coin of coins) {
      const wallet = (await dispatch(
        createWallet({
          key,
          coin: coin.currencyAbbreviation,
          chain: coin.chain as SupportedChains,
          options: {
            ...options,
            useNativeSegwit: IsSegwitCoin(coin.currencyAbbreviation),
          },
        }),
      )) as Wallet;
      const receiveAddress = (await dispatch<any>(
        createWalletAddress({wallet, newAddress: true}),
      )) as string;
      dispatch(LogActions.info(`new address generated: ${receiveAddress}`));
      wallet.receiveAddress = receiveAddress;
      wallets.push(wallet);
      for (const token of tokens) {
        if (token.chain === coin.chain) {
          const tokenWallet = await dispatch(
            createTokenWallet(
              wallet,
              token.currencyAbbreviation.toLowerCase(),
              token.tokenAddress!,
              tokenOpts,
            ),
          );
          wallets.push(tokenWallet);
        }
      }
    }

    // build out app specific props
    return wallets.map(wallet => {
      // subscribe new wallet to push notifications
      if (notificationsAccepted) {
        dispatch(subscribePushNotifications(wallet, brazeEid!));
      }
      // subscribe new wallet to email notifications
      if (
        emailNotifications &&
        emailNotifications.accepted &&
        emailNotifications.email
      ) {
        const prefs = {
          email: emailNotifications.email,
          language: defaultLanguage,
          unit: 'btc', // deprecated
        };
        dispatch(subscribeEmailNotifications(wallet, prefs));
      }
      const {currencyAbbreviation, currencyName} = dispatch(
        mapAbbreviationAndName(
          wallet.credentials.coin,
          wallet.credentials.chain,
          wallet.credentials?.token?.address,
        ),
      );
      return merge(
        wallet,
        buildWalletObj(
          {...wallet.credentials, currencyAbbreviation, currencyName},
          tokenOpts,
        ),
      );
    });
  };

/////////////////////////////////////////////////////////////

const DEFAULT_CREATION_OPTIONS: CreateOptions = {
  network: Network.mainnet,
  account: 0,
};

const createWallet =
  (params: {
    key: KeyMethods;
    coin: string;
    chain: SupportedChains;
    options: CreateOptions;
    context?: string;
  }): Effect<Promise<API>> =>
  async (dispatch): Promise<API> => {
    return new Promise((resolve, reject) => {
      const bwcClient = BWC.getClient();
      const {key, coin, chain, options, context} = params;

      // set defaults
      const {
        account,
        customAccount,
        network,
        password,
        singleAddress,
        useNativeSegwit,
        segwitVersion,
      } = {
        ...DEFAULT_CREATION_OPTIONS,
        ...options,
      };

      bwcClient.fromString(
        key.createCredentials(password, {
          coin,
          chain, // chain === coin for stored clients. THIS IS NO TRUE ANYMORE
          network,
          account,
          n: 1,
          m: 1,
        }),
      );

      const name = BitpaySupportedCoins[coin.toLowerCase()].name;
      bwcClient.createWallet(
        name,
        'me',
        1,
        1,
        {
          network,
          singleAddress,
          coin,
          chain,
          useNativeSegwit,
          segwitVersion,
        },
        (err: any) => {
          if (err) {
            switch (err.name) {
              case 'bwc.ErrorCOPAYER_REGISTERED': {
                if (context === 'WalletConnect') {
                  return reject(err);
                }
                if (customAccount) {
                  return reject(err);
                }

                const account = options.account || 0;
                if (account >= 20) {
                  return reject(
                    new Error(
                      t(
                        '20 Wallet limit from the same coin and network has been reached.',
                      ),
                    ),
                  );
                }
                return resolve(
                  dispatch(
                    createWallet({
                      key,
                      coin,
                      chain,
                      options: {...options, account: account + 1},
                    }),
                  ),
                );
              }
            }

            reject(err);
          } else {
            dispatch(LogActions.info(`Added Coin: ${chain}: ${coin}`));
            resolve(bwcClient);
          }
        },
      );
    });
  };

/////////////////////////////////////////////////////////////

const createTokenWallet =
  (
    associatedWallet: Wallet,
    tokenName: string,
    tokenAddress: string,
    tokenOptsByAddress: {[key in string]: Token},
  ): Effect<Promise<API>> =>
  async (dispatch): Promise<API> => {
    return new Promise((resolve, reject) => {
      try {
        const bwcClient = BWC.getClient();
        const tokenAddressWithSuffix = addTokenChainSuffix(
          tokenAddress,
          associatedWallet.credentials.chain,
        );

        const currentTokenOpts = tokenOptsByAddress[tokenAddressWithSuffix];

        if (!currentTokenOpts) {
          throw new Error(
            'Could not find tokenOpts for token: ' + tokenAddressWithSuffix,
          );
        }

        const tokenCredentials: Credentials =
          associatedWallet.credentials.getTokenCredentials(
            currentTokenOpts,
            associatedWallet.credentials.chain,
          );
        bwcClient.fromObj(tokenCredentials);
        // push walletId as reference - this is used later to build out nested overview lists
        associatedWallet.tokens = associatedWallet.tokens || [];
        associatedWallet.tokens.push(tokenCredentials.walletId);
        // Add the token info to the ethWallet for BWC/BWS

        associatedWallet.preferences = associatedWallet.preferences || {
          tokenAddresses: [],
          maticTokenAddresses: [],
          opTokenAddresses: [],
          arbTokenAddresses: [],
          baseTokenAddresses: [],
        };

        switch (associatedWallet.credentials.chain) {
          case 'eth':
            associatedWallet.preferences.tokenAddresses?.push(
              // @ts-ignore
              tokenCredentials.token?.address,
            );
            break;
          case 'matic':
            associatedWallet.preferences.maticTokenAddresses?.push(
              // @ts-ignore
              tokenCredentials.token?.address,
            );
            break;
          case 'op':
            associatedWallet.preferences.opTokenAddresses?.push(
              // @ts-ignore
              tokenCredentials.token?.address,
            );
            break;
          case 'base':
            associatedWallet.preferences.baseTokenAddresses?.push(
              // @ts-ignore
              tokenCredentials.token?.address,
            );
            break;
          case 'arb':
            associatedWallet.preferences.arbTokenAddresses?.push(
              // @ts-ignore
              tokenCredentials.token?.address,
            );
            break;
        }

        associatedWallet.savePreferences(
          associatedWallet.preferences,
          (err: any) => {
            if (err) {
              dispatch(LogActions.error(`Error saving token: ${tokenName}`));
            }
            dispatch(LogActions.info(`Added token ${tokenName}`));
            resolve(bwcClient);
          },
        );
      } catch (err) {
        const errstring =
          err instanceof Error ? err.message : JSON.stringify(err);
        dispatch(LogActions.error(`Error creating token wallet: ${errstring}`));
        reject();
      }
    });
  };

/////////////////////////////////////////////////////////////

export const startCreateKeyWithOpts =
  (opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
          WALLET: {keys},
        } = getState();
        const _key = BWC.createKey({
          seedType: opts.seedType!,
          seedData: opts.mnemonic || opts.extendedPrivateKey,
          useLegacyCoinType: opts.useLegacyCoinType,
          useLegacyPurpose: opts.useLegacyPurpose,
          passphrase: opts.passphrase,
        });

        const _wallet = (await dispatch(
          createWalletWithOpts({key: _key, opts}),
        )) as Wallet;

        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(_wallet, brazeEid!));
        }
        // subscribe new wallet to email notifications
        if (
          emailNotifications &&
          emailNotifications.accepted &&
          emailNotifications.email
        ) {
          const prefs = {
            email: emailNotifications.email,
            language: defaultLanguage,
            unit: 'btc', // deprecated
          };
          dispatch(subscribeEmailNotifications(_wallet, prefs));
        }

        const receiveAddress = (await dispatch<any>(
          createWalletAddress({wallet: _wallet, newAddress: true}),
        )) as string;
        dispatch(LogActions.info(`new address generated: ${receiveAddress}`));
        _wallet.receiveAddress = receiveAddress;

        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            _wallet.credentials.coin,
            _wallet.credentials.chain,
            _wallet.credentials?.token?.address,
          ),
        );

        // build out app specific props
        const wallet = merge(
          _wallet,
          buildWalletObj({
            ..._wallet.credentials,
            currencyAbbreviation,
            currencyName,
          }),
        ) as Wallet;

        const key = buildKeyObj({
          key: _key,
          wallets: [wallet],
          backupComplete: true,
        });
        dispatch(
          successCreateKey({
            key,
          }),
        );
        resolve(key);
      } catch (err) {
        const errstring =
          err instanceof Error ? err.message : JSON.stringify(err);
        dispatch(
          LogActions.error(`Error creating key with opts: ${errstring}`),
        );
        reject(err);
      }
    });
  };

/////////////////////////////////////////////////////////////

export const createWalletWithOpts =
  (params: {
    key: KeyMethods;
    opts: Partial<KeyOptions>;
  }): Effect<Promise<API>> =>
  async (dispatch): Promise<API> => {
    return new Promise((resolve, reject) => {
      const bwcClient = BWC.getClient();
      const {key, opts} = params;
      try {
        bwcClient.fromString(
          key.createCredentials(opts.password, {
            coin: opts.coin || 'btc',
            chain: opts.chain || 'btc', // chain === coin for stored clients. THIS IS NO TRUE ANYMORE
            network: opts.networkName || 'livenet',
            account: opts.account || 0,
            n: opts.n || 1,
            m: opts.m || 1,
          }),
        );
        bwcClient.createWallet(
          opts.name,
          opts.myName || 'me',
          opts.m || 1,
          opts.n || 1,
          {
            network: opts.networkName,
            singleAddress: opts.singleAddress,
            coin: opts.coin,
            chain: opts.chain,
            useNativeSegwit: opts.useNativeSegwit,
          },
          (err: Error) => {
            if (err) {
              switch (err.name) {
                case 'bwc.ErrorCOPAYER_REGISTERED': {
                  const account = opts.account || 0;
                  if (account >= 20) {
                    return reject(
                      new Error(
                        t(
                          '20 Wallet limit from the same coin and network has been reached.',
                        ),
                      ),
                    );
                  }
                  return resolve(
                    dispatch(
                      createWalletWithOpts({
                        key,
                        opts: {...opts, account: account + 1},
                      }),
                    ),
                  );
                }
              }

              reject(err);
            } else {
              dispatch(LogActions.info(`Added Coin ${opts.coin || 'btc'}`));
              resolve(bwcClient);
            }
          },
        );
      } catch (err) {
        reject(err);
      }
    });
  };

export const getDecryptPassword =
  (key: Key): Effect<Promise<string>> =>
  async dispatch => {
    return new Promise<string>((resolve, reject) => {
      dispatch(
        showDecryptPasswordModal({
          onSubmitHandler: async (_password: string) => {
            dispatch(dismissDecryptPasswordModal());
            await sleep(500);
            if (checkEncryptPassword(key, _password)) {
              return resolve(_password);
            } else {
              return reject({message: 'invalid password'});
            }
          },
        }),
      );
    });
  };

export const detectAndCreateTokensForEachEvmWallet =
  ({key, force}: {key: Key; force?: boolean}): Effect<Promise<void>> =>
  async dispatch => {
    try {
      dispatch(
        LogActions.info('starting [detectAndCreateTokensForEachEvmWallet]'),
      );

      const evmWalletsToCheck = key.wallets.filter(
        w =>
          IsEVMChain(w.chain) && !IsERCToken(w.currencyAbbreviation, w.chain),
      );

      for (const [index, w] of evmWalletsToCheck.entries()) {
        if (w.chain && w.receiveAddress) {
          const erc20WithBalanceData: MoralisErc20TokenBalanceByWalletData[] =
            await dispatch(
              getERC20TokenBalanceByWallet({
                chain: w.chain,
                address: w.receiveAddress,
              }),
            );

          let filteredTokens = erc20WithBalanceData.filter(erc20Token => {
            // Filter by: token already created in the key (present in w.tokens), possible spam and significant balance
            return (
              (!w.tokens ||
                !cloneDeep(w.tokens).some(token =>
                  token.includes(erc20Token.token_address),
                )) &&
              !erc20Token.possible_spam &&
              erc20Token.balance &&
              erc20Token.decimals &&
              parseFloat(erc20Token.balance) /
                Math.pow(10, erc20Token.decimals) >=
                1e-6
            );
          });

          let account: number | undefined;
          let customAccount = false;
          if (w.credentials.rootPath) {
            account = getAccount(w.credentials.rootPath);
            customAccount = true;
          }

          for (const [index, tokenToAdd] of filteredTokens.entries()) {
            const newTokenWallet: AddWalletData = {
              key,
              associatedWallet: w,
              currency: {
                chain: w.chain,
                currencyAbbreviation: tokenToAdd.symbol.toLowerCase(),
                isToken: true,
                tokenAddress: tokenToAdd.token_address,
                decimals: tokenToAdd.decimals,
              },
              options: {
                network: Network.mainnet,
                ...(account !== undefined && {
                  account,
                  customAccount,
                }),
              },
            };
            await dispatch(addWallet(newTokenWallet));
          }
          dispatch(
            LogActions.info('success [detectAndCreateTokensForEachEvmWallet]'),
          );
          return Promise.resolve();
        }
      }
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : JSON.stringify(err);
      dispatch(
        LogActions.error(
          `failed [detectAndCreateTokensForEachEvmWallet]: ${errorStr}`,
        ),
      );
    }
  };
