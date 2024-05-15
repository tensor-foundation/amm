import { getTensorAmmProgram } from './generated';

export const amm = () => ({
  install() {
    getTensorAmmProgram();
  },
});
