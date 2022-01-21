import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {useSelector} from 'react-redux';
import Avatar from '../../../../components/avatar/Avatar';
import {RootState} from '../../../../store';
import {User} from '../../../../store/bitpay-id/bitpay-id.models';
import {HeaderButtonContainer} from '../HomeRoot';

const ProfileButton: React.FC = () => {
  const navigation = useNavigation();
  const user = useSelector<RootState, User | null>(
    ({APP, BITPAY_ID}) => BITPAY_ID.user[APP.network],
  );

  return (
    <HeaderButtonContainer>
      <TouchableOpacity
        onPress={() => {
          user
            ? navigation.navigate('BitpayId', {screen: 'Profile'})
            : navigation.navigate('Auth', {
                screen: 'LoginSignup',
                params: {context: 'login'},
              });
        }}>
        <Avatar size={35} />
      </TouchableOpacity>
    </HeaderButtonContainer>
  );
};

export default ProfileButton;
