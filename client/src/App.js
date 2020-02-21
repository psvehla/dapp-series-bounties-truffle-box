import React, { Component } from "react";
import BountiesContract from "./contracts/Bounties.json";
import getWeb3 from "./getWeb3";
import { setJSON, getJSON } from './utils/IPFS.js'

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormGroup from 'react-bootstrap/FormGroup';
import FormControl from 'react-bootstrap/FormControl';
import FormText from 'react-bootstrap/FormText';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Card from 'react-bootstrap/Card';

import BootstrapTable from 'react-bootstrap-table/lib/BootstrapTable';
import TableHeaderColumn from 'react-bootstrap-table/lib/TableHeaderColumn';

import "./App.css";
import 'react-bootstrap-table/dist/react-bootstrap-table-all.min.css';

const etherscanBaseUrl = "https://rinkeby.etherscan.io";
const ipfsBaseUrl = "https://ipfs.infura.io/ipfs";

const eventType = {
  ISSUANCE: 'issuance',
  CANCELLATION: 'cancellation'
}

Object.freeze(eventType);

class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      bountiesInstance: undefined,
      bountyId: '',
      bountyData: undefined,
      bountyDeadline: undefined,
      bountyAmount: undefined,
      etherscanLink: etherscanBaseUrl,
      bounties: [],
      bountyEvents: [],
      account: null,
      web3: null,
    };

    this.handleIssueBounty = this.handleIssueBounty.bind(this);
    this.handleCancelBounty = this.handleCancelBounty.bind(this);
    this.handleChange = this.handleChange.bind(this);
    // this.processEventLog = this.processEventLog.bind(this);
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = BountiesContract.networks[networkId];
      const instance = new web3.eth.Contract(
        BountiesContract.abi,
        deployedNetwork && deployedNetwork.address,
      );

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({ bountiesInstance: instance, web3: web3, account: accounts[0] });
      this.addEventListener(this);
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  addEventListener(component) {
    this.state.bountiesInstance.events.BountyIssued({ fromBlock: 0, toBlock: 'latest'})
    .on('data', async function(event) {

      // first get the data from IPFS and add it to the event
      var ipfsJSON = {};

      try {
        ipfsJSON = await getJSON(event.returnValues.data);
      }
      catch(e) {
      }

      if (ipfsJSON.bountyData !== undefined) {
        event.returnValues['bountyData'] = ipfsJSON.bountyData;
        event.returnValues['ipfsData'] = ipfsBaseUrl + "/" + event.returnValues.data;
      }
      else {
        event.returnValues['bountyData'] = event.returnValues['data'];
        event.returnValues['ipfsData'] = "none";
      }

      let newBountyEventsArray = component.state.bountyEvents.slice();
      event.returnValues['eventType'] = eventType.ISSUANCE;
      newBountyEventsArray.push(event.returnValues);
      component.setState({ bountyEvents: newBountyEventsArray});

      playEventLog(component, event);
    })
    .on('error', console.error);

    this.state.bountiesInstance.events.BountyCancelled({ fromBlock: 0, toBlock: 'latest'})
    .on('data', async function(event) {
      let newBountyEventsArray = component.state.bountyEvents.slice();
      event.returnValues['eventType'] = eventType.CANCELLATION;
      newBountyEventsArray.push(event.returnValues);
      component.setState({ bountyEvents: newBountyEventsArray});

      playEventLog(component, event);
    })

    var playEventLog = async function(component) {

      var keepIssuances = function(value) {
        return value['eventType'] === eventType.ISSUANCE;
      }

      var keepCancellations = function(value) {
        return value['eventType'] === eventType.CANCELLATION;
      }

      var keepCurrentBounties = function(value) {
        return !removals.some(e => ( e.bountyId === value.bountyId ));
      }

      var newBountiesArray = component.state.bountyEvents.slice();
      newBountiesArray = newBountiesArray.filter(keepIssuances);

      var removals = component.state.bountyEvents.slice();
      removals = removals.filter(keepCancellations);

      newBountiesArray = newBountiesArray.filter(keepCurrentBounties);

      component.setState({ bounties: newBountiesArray });
    }
  }

  handleChange(event) {
    switch (event.target.name) {
      case "bountyData":
        this.setState({"bountyData": event.target.value});
        break;
      case "bountyDeadline":
        this.setState({"bountyDeadline": event.target.value});
        break;
      case "bountyAmount":
        this.setState({"bountyAmount": event.target.value});
        break;
      case "bountyId":
        this.setState({"bountyId": event.target.value});
        break;
      default:
        break;
    }
  }

  async handleIssueBounty(event) {
    if (typeof this.state.bountiesInstance !== 'undefined') {
      event.preventDefault();
      const ipfsHash = await setJSON({ bountyData: this.state.bountyData })

      let result = await this.state.bountiesInstance.methods.issueBounty(ipfsHash, this.state.bountyDeadline)
        .send({ from: this.state.account, value: this.state.web3.utils.toWei(this.state.bountyAmount, 'ether') });

      this.setLastTransactionDetails(result);
    }
  }

  async handleCancelBounty(event) {
    if (typeof this.state.bountiesInstance !== 'undefined') {
      event.preventDefault();

      let result = await this.state.bountiesInstance.methods.cancelBounty(this.state.bountyId)
        .send({ from: this.state.account });

      this.setLastTransactionDetails(result);
    }
  }

  setLastTransactionDetails(result) {
    if (result.tx !== 'undefined') {
      this.setState({ etherscanLink: etherscanBaseUrl + "/tx/" + result.tx });
    }
    else {
      this.setState({ etherscanLink: etherscanBaseUrl });
    }
  }

  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <Container>
          <Row>
            <a href={this.state.etherscanLink} target="_blank" rel="noopener noreferrer">Last Transaction Details</a>
          </Row>
          <Row>
            <Card>
              <Card.Header>Issue Bounty</Card.Header>
              <Form onSubmit={this.handleIssueBounty}>
                <FormGroup controlId="fromCreateBounty">
                  <FormControl
                    componentclass="textarea"
                    name="bountyData"
                    value={this.state.bountyData}
                    placeholder="Enter bounty details"
                    onChange={this.handleChange}
                  />
                  <FormText>Enter bounty details.</FormText>

                  <FormControl
                    type="text"
                    name="bountyDeadline"
                    value={this.state.bountyDeadline}
                    placeholder="Enter bounty deadline"
                    onChange={this.handleChange}
                  />
                  <FormText>Enter bounty deadline in seconds since epoch.</FormText>

                  <FormControl
                    type="text"
                    name="bountyAmount"
                    value={this.state.bountyAmount}
                    placeholder="Enter bounty amount"
                    onChange={this.handleChange}
                  />
                  <FormText>Enter bounty amount</FormText>
                  <Button type="submit">issue bounty</Button>
                </FormGroup>
              </Form>
            </Card>
          </Row>
          <Row>
            <Card>
              <Card.Header>Cancel Bounty</Card.Header>
              <Form onSubmit={this.handleCancelBounty}>
                <FormGroup controlId="formCancelBounty">
                  <FormControl
                    componentclass="textarea"
                    name="bountyId"
                    value={this.state.bountyId}
                    placeholder="Enter bounty ID"
                    onChange={this.handleChange}
                  />
                  <FormText>Enter bounty ID.</FormText>
                  <Button type="submit">cancel bounty</Button>
                </FormGroup>
              </Form>
            </Card>
          </Row>
          <Row>
            <Card>
              <Card.Header>Available Bounties</Card.Header>
              <BootstrapTable data={this.state.bounties} striped hover>
                <TableHeaderColumn isKey dataField='bountyId'>ID</TableHeaderColumn>
                <TableHeaderColumn dataField='issuer'>Issuer</TableHeaderColumn>
                <TableHeaderColumn dataField='amount'>Amount</TableHeaderColumn>
                <TableHeaderColumn dataField='ipfsData'>IPFS Data</TableHeaderColumn>
                <TableHeaderColumn dataField='bountyData'>Bounty Data</TableHeaderColumn>
              </BootstrapTable>
            </Card>
          </Row>
        </Container>
      </div>
    );
  }
}

export default App;
