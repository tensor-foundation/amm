import { getAmmProgram } from './generated';

export const amm = () => ({
  install() {
    getAmmProgram();
  },
});
