declare module 'react-admin-color-components' {
  import { FC } from 'react';
  import { InputProps } from 'react-admin';

  export interface ColorInputProps extends Omit<InputProps, 'source'> {
    source?: string;
    label?: string;
    picker?: 'Chrome' | 'Sketch' | 'Photoshop' | 'Block' | 'Github' | 'Twitter' | 'Circle' | 'Hue' | 'Slider' | 'Compact' | 'Material' | 'Swatches';
  }

  export interface ColorFieldProps {
    source?: string;
    label?: string;
    record?: any;
  }

  export const ColorInput: FC<ColorInputProps>;
  export const ColorField: FC<ColorFieldProps>;
}
