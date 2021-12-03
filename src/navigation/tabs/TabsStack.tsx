import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigatorScreenParams} from '@react-navigation/native';

import HomeRoot from './home/HomeStack';
import WalletRoot from './wallet/WalletStack';
import CardRoot from './card/CardStack';
import SettingsRoot from './settings/SettingsStack';
import {SettingsStackParamList} from './settings/SettingsStack';

import {SvgProps} from 'react-native-svg';
import HomeIcon from '../../../assets/img/tab-icons/home.svg';
import HomeFocusedIcon from '../../../assets/img/tab-icons/home-focused.svg';
import WalletIcon from '../../../assets/img/tab-icons/wallet.svg';
import WalletFocusedIcon from '../../../assets/img/tab-icons/wallet-focused.svg';
import CardIcon from '../../../assets/img/tab-icons/card.svg';
import CardFocusedIcon from '../../../assets/img/tab-icons/card-focused.svg';
import SettingsIcon from '../../../assets/img/tab-icons/settings.svg';
import SettingsFocusedIcon from '../../../assets/img/tab-icons/settings-focused.svg';
import TransactButtonIcon from '../../../assets/img/tab-icons/transact-button.svg';

import {useAndroidBackHandler} from 'react-navigation-backhandler';
import TransactModal from '../../components/modal/transact-menu/TransactMenu';

const Icons: {[key: string]: React.FC<SvgProps>} = {
  Home: HomeIcon,
  HomeFocused: HomeFocusedIcon,
  Wallet: WalletIcon,
  WalletFocused: WalletFocusedIcon,
  Card: CardIcon,
  CardFocused: CardFocusedIcon,
  Settings: SettingsIcon,
  SettingsFocused: SettingsFocusedIcon,
  TransactButton: TransactButtonIcon,
};

export enum TabsScreens {
  HOME = 'Home',
  WALLET = 'Wallet',
  TRANSACT_BUTTON = 'TransactButton',
  CARD = 'Card',
  SETTINGS = 'Settings',
  CAMERA = 'Camera',
}

export type TabsStackParamList = {
  Home: undefined;
  Wallet: undefined;
  TransactButton: undefined;
  Card: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
  Camera: undefined;
};

const Tab = createBottomTabNavigator<TabsStackParamList>();

const TabsStack = () => {
  useAndroidBackHandler(() => true);
  const TransactionButton = () => null;
  return (
    <Tab.Navigator
      initialRouteName={TabsScreens.HOME}
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarShowLabel: false,
        lazy: true,
        tabBarIcon: ({focused}) => {
          let {name: icon} = route;

          if (focused) {
            icon += 'Focused';
          }
          const Icon = Icons[icon];

          return <Icon />;
        },
      })}>
      <Tab.Screen name={TabsScreens.HOME} component={HomeRoot} />
      <Tab.Screen name={TabsScreens.WALLET} component={WalletRoot} />
      <Tab.Screen
        name={TabsScreens.TRANSACT_BUTTON}
        component={TransactionButton}
        options={{tabBarButton: () => <TransactModal />}}
      />
      <Tab.Screen name={TabsScreens.CARD} component={CardRoot} />
      <Tab.Screen name={TabsScreens.SETTINGS} component={SettingsRoot} />
    </Tab.Navigator>
  );
};

export default TabsStack;
