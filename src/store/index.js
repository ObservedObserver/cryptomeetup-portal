import Vue from 'vue';
import Vuex from 'vuex';
import { Toast } from 'buefy/dist/components/toast';
import Land from '@/util/land';
import getApi from '@/util/apis/index.js'
import ui from './ui';
import Global from '@/Global.js';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    ui,
  },
  state: {
    contractType: 'eos',
    isScatterConnected: false,
    scatterAccount: null,
    portalInfoList: [],
    balances: {
      eos: '0 EOS',
      cmu: '0 CMU',
    },
    isScatterLoggingIn: false,
    isLoadingData: false,
    landInfo: {},
    landInfoUpdateAt: null,
    marketInfo: {},
    stakedInfo: { 
      staked: 0,
      refund: '0 CMU',
    },
    myCheckInStatus: [],
    globalInfo: null,
    dividendInfo: {
      land_profit: 0,
      ref_profit: 0,
      fee_profit: 0,
      pool_profit: 0,
      staked_income: 0,
      council_income: 0,
    },
  },
  mutations: {
    setContractType(state, type) {
      state.contractType = type
    },
    setLandInfo(state, landInfo) {
      state.landInfo = landInfo;
      state.landInfoUpdateAt = new Date();
    },
    setMarketInfo(state, marketInfo) {
      state.marketInfo = marketInfo;
    },
    setStakedInfo(state, stakedInfo) {
      state.stakedInfo = stakedInfo;
    },
    setGlobalInfo(state, globalInfo) {
      state.globalInfo = globalInfo;
    },
    setIsScatterLoggingIn(state, isScatterLoggingIn) {
      state.isScatterLoggingIn = isScatterLoggingIn;
    },
    setIsLoadingData(state, isLoadingData) {
      state.isLoadingData = isLoadingData;
    },
    setIsScatterConnected(state, isScatterConnected) {
      state.isScatterConnected = isScatterConnected;
    },
    setScatterAccount(state, account) {
      state.scatterAccount = account;
    },
    setMyBalance(state, { symbol, balance }) {
      state.balances[symbol] = balance;
    },
    setDividendInfo(state, dividendInfo) {
      state.dividendInfo = dividendInfo;
    },
    setMyCheckInStatus(state, status) {
      state.myCheckInStatus = status;
    },
    setPortalInfoList(state, portalInfoList) {
      Global.setPortalInfoList(portalInfoList)
      state.portalInfoList = portalInfoList
    }
  },
  actions: {
    updateContractType() {

    },
    async connectScatterAsync({ commit, dispatch, state }) {
      console.log('Connecting to Scatter desktop...');
      const connected = await getApi(state.contractType).api.connectScatterAsync();
      console.log('Connect Scatter result: ', connected);
      if (connected) {
        commit('setIsScatterConnected', true);
        if (getApi(state.contractType).currentEOSAccount()) {
          commit('setScatterAccount', getApi(state.contractType).currentEOSAccount());
          dispatch('getMyBalances');
          dispatch('getPortalInfo');
          dispatch('getMyStakedInfo');
          dispatch('getPlayerInfo');
          dispatch('updateMyCheckInStatus');
        }
      }
    },
    async getMyBalances({ commit, state }) {
      const { name } = state.scatterAccount;
      const balances = await Promise.all([
        getApi(state.contractType).api.getBalancesByContract({ symbol: state.contractType === 'eos' ? 'eos' : 'BOS', accountName: name }),
        getApi(state.contractType).api.getBalancesByContract(state.contractType === 'eos' ? {
          symbol: 'cmu', accountName: name, tokenContract: 'dacincubator'
        } : {
          symbol: 'CMU', accountName: name, tokenContract: 'ncldwqxpkgav'
        })
      ]);
      const eos = balances[0][0];
      const cmu = balances[1][0];
      commit('setMyBalance', { symbol: state.contractType === 'eos' ? 'eos' : 'bos', balance: eos });
      commit('setMyBalance', { symbol: 'cmu', balance: cmu });
    },
    async updateLandInfoAsync({ commit, state }) {
      commit('setIsLoadingData', true);
      try {
        const landInfo = {};
        const rows = await getApi(state.contractType).api.getLandsInfoAsync();
        rows.forEach((row) => {
          const countryCode = Land.landIdToCountryCode(row.id);
          landInfo[countryCode] = {
            ...row,
            code: countryCode,
          };
        });
        console.log(rows, rows.length)
        commit('setLandInfo', landInfo);
      } catch (err) {
        console.error('Failed to fetch land info', err);
      }
      commit('setIsLoadingData', false);
    },
    async updateMarketInfoAsync({ commit, state }) {
      try {
        const marketInfoTable = await getApi(state.contractType).api.getMarketInfoAsync();
        const marketInfo = marketInfoTable[0];
        marketInfo.coin_price = `${((parseFloat(marketInfo.supply.split(' ')[0])) / 10000000000).toDecimal(4).toString()} EOS`;
        marketInfo.supply = `${(parseFloat(marketInfo.supply.split(' ')[0]) - 40000000).toDecimal(4).toString()} CMU`;
        // price, balance, coin_price
        commit('setMarketInfo', marketInfo);
      } catch (err) {
        console.error('Failed to fetch market info', err);
      }
    },
    async getMyStakedInfo({ commit, state }) {
      try {
        const stakedInfoList = await getApi(state.contractType).api.getMyStakedInfoAsync({ accountName: state.scatterAccount.name });
        const refund = await getApi(state.contractType).api.getRefund();
        stakedInfoList[0].refund = (refund.amount || '0 CMU');
        stakedInfoList[0].timestamp = (refund.request_time || '0');
        if (stakedInfoList[0] == null) {
          commit('setStakedInfo', { to: '', staked: 0 });
        } else {
          commit('setStakedInfo', stakedInfoList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch staked info', err);
      }
    },
    async updateMyCheckInStatus({ commit, state }) {
      const status = await getApi(state.contractType).api.getMyCheckInStatus({ accountName: state.scatterAccount.name });
      commit('setMyCheckInStatus', status);
    },
    async getPlayerInfo({ commit, state }) {
      try {
        const playerInfoList = await getApi(state.contractType).api.getPlayerInfoAsync({ accountName: state.scatterAccount.name });
        if (playerInfoList[0] == null) {
          commit('setDividendInfo', {
            land_profit: 0,
            ref_profit: 0,
            fee_profit: 0,
            pool_profit: 0,
            staked_income: 0,
            council_income: 0,
          });
        } else {
          commit('setDividendInfo', playerInfoList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch pool_profit', err);
      }
    },
    async getGlobalInfo({ commit, state }) {
      try {
        const globalInfoList = await getApi(state.contractType).api.getGlobalInfoAsync();        
        commit('setGlobalInfo', globalInfoList[0]);
      } catch (err) {
        console.error('Failed to fetch staked info', err);
      }
    },
    async getPortalInfo({ commit, state }) {
      try {
        const portalInfoList = await getApi(state.contractType).api.getPortalInfoAsync();
        commit('setPortalInfoList', portalInfoList);
      } catch (err) {
        console.error('Failed to fetch staked info', err);
      }
    },
    async loginScatterAsync({ commit, dispatch, state }) {
      commit('setIsScatterLoggingIn', true);
      try {
        const identity = await getApi(state.contractType).api.loginScatterAsync();
        if (!identity) {
          commit('setScatterAccount', null);
          return;
        }
        const account = identity.accounts.find(({ blockchain }) => blockchain === 'eos');
        commit('setScatterAccount', account);
        Toast.open({
          message: 'You successfully logged in Scatter!',
          type: 'is-success',
          queue: false,
        });
        dispatch('getMyBalances');
        dispatch('getMyStakedInfo');
        dispatch('getPlayerInfo');
        dispatch('getPortalInfo')
      } catch (err) {
        console.error('Failed to login Scatter', err);
        Toast.open({
          message: `Failed to login Scatter: ${err.message}.`,
          type: 'is-danger',
          queue: false,
          duration: 5000,
        });
      }
      commit('setIsScatterLoggingIn', false);
    },
    async logoutScatterAsync({ commit, state }) {
      try {
        await getApi(state.contractType).api.logoutScatterAsync();
      } catch (err) {
        console.error('Failed to logout Scatter', err);
      }
      commit('setScatterAccount', null);
      Toast.open({
        message: 'You successfully logged out!',
        type: 'is-success',
        queue: false,
      });
    },
  },
});
