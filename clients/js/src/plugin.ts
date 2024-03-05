import { getProjectNameProgram } from './generated';

export const projectName = () => ({
  install() {
    getProjectNameProgram();
  },
});
