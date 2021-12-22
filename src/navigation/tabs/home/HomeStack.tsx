import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {
  baseNavigatorOptions,
  baseScreenOptions,
} from '../../../constants/NavigationOptions';
import HomeRoot from './HomeRoot';
import styled from 'styled-components/native';
import ProfileSvg from '../../../../assets/img/home/profile.svg';
import ScanSvg from '../../../../assets/img/home/scan.svg';
import {ScreenGutter} from '../../../components/styled/Containers';
import {TouchableOpacity} from 'react-native';
import {navigationRef} from '../../../Root';

export type HomeStackParamList = {
  Root: undefined;
};

export enum HomeScreens {
  Root = 'Root',
}

const HeaderContainer = styled.View`
  flex-direction: row;
  margin: 0 ${ScreenGutter};
`;

const ScanImg = styled.View`
  margin-right: ${ScreenGutter};
`;

const Home = createStackNavigator<HomeStackParamList>();

const HomeStack = () => {
  const goToQRScan = () => {
    navigationRef.navigate('Camera', {screen: 'Root'});
  };
  //  TODO: Update me
  const HeaderRightComponent = (
    <HeaderContainer>
      <ScanImg>
        <TouchableOpacity onPress={goToQRScan}>
          <ScanSvg />
        </TouchableOpacity>
      </ScanImg>
      <ProfileSvg />
    </HeaderContainer>
  );

  return (
    <Home.Navigator
      initialRouteName={HomeScreens.Root}
      screenOptions={{
        ...baseNavigatorOptions,
        ...baseScreenOptions,
      }}>
      <Home.Screen
        name={HomeScreens.Root}
        component={HomeRoot}
        options={{
          headerLeft: () => null,
          headerTitle: () => null,
          headerRight: () => HeaderRightComponent,
        }}
      />
    </Home.Navigator>
  );
};

export default HomeStack;
