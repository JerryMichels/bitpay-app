import {CardContainer, CardGutter} from '../styled/Containers';
import styled from 'styled-components/native';
import * as React from 'react';
import {ReactElement, ReactNode} from 'react';

const CardHeader = styled.View`
  min-height: 30px;
  padding: ${CardGutter};
`;

const CardBody = styled.View`
  flex-grow: 1;
  padding: ${CardGutter};
`;

const CardFooter = styled.View`
  min-height: 30px;
  padding: ${CardGutter};
`;

const BackgroundImage = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: auto;
  width: auto;
  border-radius: 27px;
  overflow: hidden;
`;

export interface CardProps {
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  backgroundImg?: () => ReactElement;
  containerProps?: {
    width?: string;
    minHeight?: string;
    backgroundColor?: string;
  };
}

const Card = ({
  header,
  body,
  footer,
  backgroundImg,
  containerProps,
}: CardProps) => {
  const width = containerProps && containerProps.width;
  const minHeight = containerProps && containerProps.minHeight;
  const backgroundColor = containerProps && containerProps.backgroundColor;
  return (
    <CardContainer
      backgroundColor={backgroundColor}
      width={width}
      minHeight={minHeight}>
      {backgroundImg && <BackgroundImage>{backgroundImg()}</BackgroundImage>}

      {header && <CardHeader>{header}</CardHeader>}
      {body && <CardBody>{body}</CardBody>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </CardContainer>
  );
};

export default Card;
