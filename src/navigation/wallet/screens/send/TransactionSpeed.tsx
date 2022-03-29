import React, {useEffect, useState} from 'react';
import {BaseText, H4, H7, Paragraph} from '../../../../components/styled/Text';
import {
  Fee,
  getFeeLevels,
  GetFeeOptions,
} from '../../../../store/wallet/effects/fee/fee';
import {Wallet} from '../../../../store/wallet/wallet.models';
import * as _ from 'lodash';
import {showBottomNotificationModal} from '../../../../store/app/app.actions';
import {
  CustomErrorMessage,
  MinFeeWarning,
} from '../../components/ErrorMessages';
import {useAppDispatch} from '../../../../utils/hooks';
import {
  GetFeeUnits,
  GetTheme,
  IsERCToken,
} from '../../../../store/wallet/utils/currency';
import styled from 'styled-components/native';
import {
  ActionContainer,
  ActiveOpacity,
  CtaContainer,
  ScreenGutter,
  SheetContainer,
  WIDTH,
} from '../../../../components/styled/Containers';
import SheetModal from '../../../../components/modal/base/sheet/SheetModal';
import Back from '../../../../components/back/Back';
import {TouchableOpacity, View} from 'react-native';
import {DetailsList} from './confirm/Shared';
import Button from '../../../../components/button/Button';
import {Caution, Slate, SlateDark, White} from '../../../../styles/colors';
import {CurrencyImage} from '../../../../components/currency-image/CurrencyImage';

const CIRCLE_SIZE = 20;

export type TransactionSpeedParamList = {
  feeLevel: string;
  wallet: Wallet;
  isSpeedUpTx?: boolean;
  customFeePerKB?: number;
  feePerSatByte?: number;
  isVisible: boolean;
  onCloseModal: (level?: string, customFeePerKB?: number) => void;
};

enum ethAvgTime {
  normal = 'within 5 minutes',
  priority = 'within 2 minutes',
  urgent = 'ASAP',
}

const TxSpeedContainer = styled(SheetContainer)`
  flex: 1;
  justify-content: flex-start;
  margin-top: 0px;
  padding: 20px 0;
`;

const SheetHeaderContainer = styled.View`
  margin: 20px 0;
  align-items: center;
  flex-direction: row;
`;

const TitleContainer = styled.View`
  justify-content: center;
  align-items: center;
  width: ${WIDTH - 110}px;
`;

export const TextInput = styled.TextInput`
  height: 50px;
  color: ${({theme}) => theme.colors.text};
  background: ${({theme}) => theme.colors.background};
  border: 0.75px solid ${Slate};
  border-top-right-radius: 4px;
  border-top-left-radius: 4px;
  padding: 5px;
`;

const ErrorText = styled(BaseText)`
  color: ${Caution};
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
`;

const StepsContainer = styled.View`
  flex-direction: row;
  margin: ${ScreenGutter};
`;

const StepContainer = styled.View<{length: number}>`
  /* Circle size + horizontal gutter */
  width: ${({length}) => (WIDTH - (CIRCLE_SIZE + 30)) / length}px;
`;

const Step = styled.View<{isLast?: boolean}>`
  flex-direction: row;
`;

const Circle = styled.Pressable<{isActive: boolean; backgroundColor: string}>`
  background-color: ${({backgroundColor}) => backgroundColor};
  width: ${CIRCLE_SIZE}px;
  height: ${CIRCLE_SIZE}px;
  border-width: ${({isActive}) => (isActive ? '3px' : 0)};
  border-color: ${White};
  border-radius: 50px;
  transform: ${({isActive}) => (isActive ? 'scale(1.3)' : 'scale(1)')};
  z-index: 1;
`;

const Line = styled.View<{backgroundColor: string}>`
  background-color: ${({backgroundColor}) => backgroundColor};
  flex-grow: 1;
  height: 2px;
  align-self: center;
`;

const TopLabelContainer = styled.View`
  min-height: 30px;
`;

const BottomLabelContainer = styled.View`
  justify-content: space-between;
  flex-direction: row;
  margin: 0 ${ScreenGutter};
`;

const StepBottomLabel = styled(H7)`
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const StepTopLabel = styled(H7)<{length: number}>`
  text-align: center;
  left: -50%;
  width: ${({length}) => (WIDTH + (length - 1 + CIRCLE_SIZE)) / length}px;
`;

const TxSpeedParagraph = styled(Paragraph)`
  margin: 0 ${ScreenGutter} ${ScreenGutter};
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const StepsHeader = styled.View`
  flex-direction: row;
  align-items: center;
`;

const StepsHeaderContainer = styled.View`
  margin: ${ScreenGutter} ${ScreenGutter} 0;
`;

const CurrencyImageContainer = styled.View`
  margin-right: 10px;
`;

const StepsHeaderSubTitle = styled(Paragraph)`
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
  padding-top: 5px;
  min-height: 30px;
`;

const FEE_MIN = 0;
const FEE_MULTIPLIER = 10;

const TransactionSpeed = ({
  isVisible,
  onCloseModal,
  wallet,
  isSpeedUpTx,
  customFeePerKB = 0,
  feeLevel,
  feePerSatByte: paramFeePerSatByte,
}: TransactionSpeedParamList) => {
  const {
    img,
    credentials: {coin, network},
  } = wallet;
  const dispatch = useAppDispatch();

  const [speedUpMinFeePerKb, setSpeedUpMinFeePerKb] = useState<number>();
  const {feeUnit, feeUnitAmount, blockTime} = GetFeeUnits(coin);
  const [feeOptions, setFeeOptions] = useState<any[]>();
  const [feePerSatByte, setFeePerSatByte] = useState<
    number | string | undefined
  >(paramFeePerSatByte);
  const [selectedSpeed, setSelectedSpeed] = useState(feeLevel);
  const [customSatsPerByte, setCustomSatsPerByte] = useState(
    feePerSatByte ? feePerSatByte + '' : undefined,
  );
  const [error, setError] = useState<string | undefined>();
  const [disableApply, setDisableApply] = useState(false);
  const [maxFeeRecommended, setMaxFeeRecommended] = useState<number>();
  const [minFeeRecommended, setMinFeeRecommended] = useState<number>();
  const minFeeAllowed = FEE_MIN;
  const [maxFeeAllowed, setMaxFeeAllowed] = useState<number>();

  const {coinColor: backgroundColor} =
    coin === 'btc' ? GetTheme(coin) : GetTheme('eth');

  const setSpeedUpMinFee = (_feeLevels: Fee[]) => {
    const minFeeLevel = coin === 'btc' ? 'custom' : 'priority';
    let feeLevelsAllowed: Fee[] = [];
    if (coin === 'btc') {
      feeLevelsAllowed = _feeLevels.filter(
        (f: Fee) => f.feePerKb >= customFeePerKB,
      );
      const _speedUpMinFeePerKb = feeLevelsAllowed.length
        ? // @ts-ignore
          _.minBy(feeLevelsAllowed, 'feePerKb').feePerKb
        : customFeePerKB;
      setSpeedUpMinFeePerKb(_speedUpMinFeePerKb);
    } else {
      const {feePerKb} =
        _feeLevels.find((f: Fee) => f.level === minFeeLevel) || {};
      if (feePerKb) {
        setSpeedUpMinFeePerKb(feePerKb);
      }
    }
  };

  const setFeeRate = (_feeLevels: Fee[]) => {
    let _feeOptions: any[] = [];
    _feeLevels.forEach((fee: Fee) => {
      const {feePerKb, level, nbBlocks} = fee;
      const feeOption: any = {
        ...fee,
        feeUnit,
        uiLevel: GetFeeOptions(coin)[level],
      };

      feeOption.feePerSatByte = (feePerKb / feeUnitAmount).toFixed();
      feeOption.uiFeePerSatByte = `${feeOption.feePerSatByte} ${feeUnit}`;

      if (coin === 'eth' || IsERCToken(coin)) {
        // @ts-ignore
        feeOption.avgConfirmationTime = ethAvgTime[level];
      } else {
        const min = nbBlocks * blockTime;
        const hours = Math.floor(min / 60);
        feeOption.avgConfirmationTime =
          hours > 0
            ? hours === 1
              ? 'within an hour'
              : `within ${hours} hours`
            : `within ${min} minutes`;
      }

      if (level === feeLevel) {
        setFeePerSatByte((feePerKb / feeUnitAmount).toFixed());
      }

      if (isSpeedUpTx) {
        feeOption.disabled = speedUpMinFeePerKb || feePerKb < 0;
      }

      _feeOptions.push(feeOption);
    });

    _feeOptions = _feeOptions.reverse();
    setFeeOptions(_feeOptions);

    setFeesRecommended(_feeLevels);
    if (feeLevel === 'custom') {
      checkFees(feePerSatByte);
    }
  };

  const [feeLevels, setFeeLevels] = useState<Fee>();

  const init = async () => {
    try {
      const _feeLevels = await getFeeLevels({
        wallet,
        network,
      });

      if (_.isEmpty(_feeLevels)) {
        dispatch(
          showBottomNotificationModal(
            CustomErrorMessage({errMsg: 'Could not get fee levels'}),
          ),
        );
        return;
      }

      setFeeLevels(feeLevels);
      if (isSpeedUpTx) {
        setSpeedUpMinFee(_feeLevels);
      }

      setFeeRate(_feeLevels);
      if (customFeePerKB) {
        setCustomSatsPerByte((customFeePerKB / feeUnitAmount).toFixed());
      }
    } catch (e) {}
  };

  const checkFees = (
    customFeePerSatByte: string | number | undefined,
  ): void => {
    setError(undefined);
    const fee = Number(customFeePerSatByte);

    if (!fee) {
      setDisableApply(true);
      setError('required');
      return;
    }

    if (fee < minFeeAllowed) {
      setError('showMinError');
      setDisableApply(true);
      return;
    }

    if (
      fee > minFeeAllowed &&
      minFeeRecommended !== undefined &&
      fee < minFeeRecommended
    ) {
      setError('showMinWarning');
    }

    if (
      maxFeeAllowed &&
      fee <= maxFeeAllowed &&
      maxFeeRecommended !== undefined &&
      fee > maxFeeRecommended
    ) {
      setError('showMaxWarning');
    }

    if (maxFeeAllowed && fee > maxFeeAllowed) {
      setError('showMaxError');
      setDisableApply(true);
      return;
    }

    setDisableApply(false);
    return;
  };

  useEffect(() => {
    init();
  }, [wallet]);

  const onClose = () => {
    onCloseModal();
    setSelectedSpeed(feeLevel);
  };

  const onApply = () => {
    if (selectedSpeed === 'custom' && customSatsPerByte) {
      const _customFeePerKB = Number(
        (+customSatsPerByte * feeUnitAmount).toFixed(),
      );

      if (error === 'showMinWarning') {
        dispatch(
          showBottomNotificationModal(
            MinFeeWarning(() => {
              onCloseModal(selectedSpeed, _customFeePerKB);
            }),
          ),
        );
        return;
      }
      onCloseModal(selectedSpeed, _customFeePerKB);
    } else {
      onCloseModal(selectedSpeed);
    }
  };

  const setFeesRecommended = (_feeLevels: Fee[]): void => {
    let {minValue, maxValue} = getRecommendedFees(_feeLevels);
    setMaxFeeRecommended(maxValue);
    setMinFeeRecommended(minValue);
    setMaxFeeAllowed(maxValue * FEE_MULTIPLIER);
  };

  const getRecommendedFees = (
    _feeLevels: Fee[],
  ): {minValue: number; maxValue: number} => {
    const value = _feeLevels.map(({feePerKb}: Fee) => feePerKb);
    const maxValue = Math.max(...value);

    let minValue;
    if (isSpeedUpTx && speedUpMinFeePerKb) {
      minValue = speedUpMinFeePerKb;
    } else {
      minValue = Math.min(...value);
    }

    return {
      maxValue: parseInt((maxValue / feeUnitAmount).toFixed(), 10),
      minValue: parseInt((minValue / feeUnitAmount).toFixed(), 10),
    };
  };

  const onSelectCustomFee = () => {
    setError(undefined);
    setSelectedSpeed('custom');
    if (customSatsPerByte) {
      checkFees(customSatsPerByte);
    }
  };

  const getSelectedFeeOption = () => {
    return feeOptions?.find(({level}) => level === selectedSpeed);
  };

  const getBackgroundColor = (index?: number) => {
    if (selectedSpeed === 'custom') {
      return backgroundColor;
    }

    if (index !== undefined) {
      const selectedIndex =
        feeOptions?.findIndex(({level}) => level === selectedSpeed) || 0;

      if (!(selectedIndex + 1 <= index)) {
        return backgroundColor;
      }
    }

    return '#E1E7E4';
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={onClose}>
      <TxSpeedContainer>
        <SheetHeaderContainer>
          <TouchableOpacity
            activeOpacity={ActiveOpacity}
            onPress={() => onClose()}>
            <Back opacity={1} />
          </TouchableOpacity>
          <TitleContainer>
            <H4>Transaction Speed</H4>
          </TitleContainer>
        </SheetHeaderContainer>

        <TxSpeedParagraph>
          The higher the fee, the greater the incentive a miner has to include
          that transaction in a block. Current fees are determined based on
          network load and the selected policy.
        </TxSpeedParagraph>

        <View>
          {feeOptions && feeOptions.length > 0 ? (
            <>
              <StepsHeaderContainer>
                <StepsHeader>
                  <CurrencyImageContainer>
                    <CurrencyImage img={img} size={20} />
                  </CurrencyImageContainer>
                  <H4>
                    {coin === 'btc' ? 'Bitcoin' : 'Ethereum'} Network Fee Policy
                  </H4>
                </StepsHeader>

                <StepsHeaderSubTitle>
                  {selectedSpeed === 'custom' && customSatsPerByte
                    ? `${customSatsPerByte} ${feeUnit}`
                    : null}
                  {selectedSpeed !== 'custom'
                    ? `${getSelectedFeeOption()?.uiFeePerSatByte} ${
                        getSelectedFeeOption()?.avgConfirmationTime
                      }`
                    : null}
                </StepsHeaderSubTitle>
              </StepsHeaderContainer>

              <StepsContainer>
                {feeOptions.map((fee, i, {length}) => (
                  <StepContainer key={i} length={length}>
                    <TopLabelContainer>
                      {i !== 0 && selectedSpeed === fee.level ? (
                        <View style={{flexShrink: 1}}>
                          <StepTopLabel length={length} medium={true}>
                            {fee.uiLevel}
                          </StepTopLabel>
                        </View>
                      ) : null}
                    </TopLabelContainer>

                    <Step>
                      <Circle
                        isActive={selectedSpeed === fee.level}
                        onPress={() => {
                          setDisableApply(false);
                          setSelectedSpeed(fee.level);
                        }}
                        backgroundColor={getBackgroundColor(i)}
                        style={[
                          {
                            shadowColor: '#000',
                            shadowOffset: {width: -2, height: 4},
                            shadowOpacity:
                              selectedSpeed === fee.level ? 0.1 : 0,
                            shadowRadius: 5,
                            borderRadius: 12,
                            elevation: 3,
                          },
                        ]}
                      />

                      <Line backgroundColor={getBackgroundColor(i + 1)} />
                    </Step>
                  </StepContainer>
                ))}

                <View>
                  <TopLabelContainer />

                  <Step isLast={true}>
                    <Circle
                      isActive={selectedSpeed === 'custom'}
                      onPress={onSelectCustomFee}
                      backgroundColor={getBackgroundColor()}
                      style={[
                        {
                          shadowColor: '#000',
                          shadowOffset: {width: -2, height: 4},
                          shadowOpacity: selectedSpeed === 'custom' ? 0.1 : 0,
                          shadowRadius: 5,
                          borderRadius: 12,
                          elevation: 3,
                        },
                      ]}
                    />
                  </Step>
                </View>
              </StepsContainer>

              <BottomLabelContainer>
                <StepBottomLabel>{feeOptions[0].uiLevel}</StepBottomLabel>
                <StepBottomLabel>Custom</StepBottomLabel>
              </BottomLabelContainer>

              <DetailsList>
                {selectedSpeed === 'custom' ? (
                  <ActionContainer>
                    <TextInput
                      keyboardType="numeric"
                      value={customSatsPerByte}
                      onChangeText={(text: string) => {
                        checkFees(text);
                        setCustomSatsPerByte(text);
                      }}
                    />
                    {error === 'required' ? (
                      <ErrorText>Fee is required.</ErrorText>
                    ) : null}
                    {error === 'showMinWarning' ? (
                      <ErrorText>Fee is lower than recommended.</ErrorText>
                    ) : null}
                    {error === 'showMaxWarning' ? (
                      <ErrorText>
                        Fee should not be higher than {maxFeeRecommended}{' '}
                        {feeUnit}.
                      </ErrorText>
                    ) : null}
                    {error === 'showMinError' ? (
                      <ErrorText>
                        Fee should be higher than {minFeeAllowed} {feeUnit}.
                      </ErrorText>
                    ) : null}
                    {error === 'showMaxError' ? (
                      <ErrorText>
                        Fee Should be lesser than {maxFeeAllowed} {feeUnit}.
                      </ErrorText>
                    ) : null}
                  </ActionContainer>
                ) : null}
              </DetailsList>

              <CtaContainer>
                <Button onPress={() => onApply()} disabled={disableApply}>
                  Apply
                </Button>
              </CtaContainer>
            </>
          ) : null}
        </View>
      </TxSpeedContainer>
    </SheetModal>
  );
};

export default TransactionSpeed;
