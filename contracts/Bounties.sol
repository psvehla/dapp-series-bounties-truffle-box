pragma solidity ^0.5.16;

/**
 * @title Bounties
 * @author Peter (based on tute)
 * @dev Smart contract that allows a user to issue a bounty in ETH for the fulfilment of a task.
 */

contract Bounties {

    /*
     * Enums
     */
    enum BountyStatus { CREATED, ACCEPTED, CANCELLED }

    /*
     * Storage
     */
    Bounty[] public bounties;

    mapping(uint=>Fulfilment[]) fulfilments;

    /*
     * Structs
     */
    struct Bounty {
        address payable issuer;
        uint deadline;
        string data;
        BountyStatus status;
        uint amount;
    }

    struct Fulfilment {
        bool accepted;
        address payable fulfiler;
        string data;
    }

    /**
     * @dev Constructor
     */
    constructor() public {}

    /**
     * @dev issueBounty(): instantiates a new bounty
     * @param _data the requirement of the bounty
     * @param _deadline the Unix timestamp after which fulfilments will no longer be accepted
     */
    function issueBounty(
        string memory _data,
        uint64 _deadline
    )

    public payable hasValue() validateDeadline(_deadline) returns (uint)
    {
        bounties.push(Bounty(msg.sender, _deadline, _data, BountyStatus.CREATED, msg.value));
        emit BountyIssued(bounties.length - 1, msg.sender, msg.value, _data);
        return (bounties.length - 1);
    }

    /**
     * @dev fulfilBounty(): submit a fulfilment of a bounty
     * @param _bountyId the bounty being fulfiled
     * @param _data the IPFS hash containing evidence of fulfilment
     */
    function fulfilBounty(
        uint _bountyId,
        string memory _data
    )

    public bountyExists(_bountyId) notIssuer(_bountyId) hasStatus(_bountyId, BountyStatus.CREATED) isBeforeDeadline(_bountyId)
    {
        fulfilments[_bountyId].push(Fulfilment(false, msg.sender, _data));
        emit BountyFulfiled(_bountyId, msg.sender, fulfilments[_bountyId].length - 1, _data);
    }

    /**
     * @dev acceptFulfilment(): accepts a submitted fulfilment and pays the BountyFulfiled
     * @param _bountyId the bounty's id
     * @param _fulfilmentId the fulfilment's id
     */
    function acceptFulfilment(
        uint _bountyId,
        uint _fulfilmentId
    )

    public bountyExists(_bountyId) fulfilmentExists(_bountyId, _fulfilmentId) onlyIssuer(_bountyId) hasStatus(_bountyId, BountyStatus.CREATED) fulfilmentNotYetAccepted(_bountyId, _fulfilmentId)
    {
        fulfilments[_bountyId][_fulfilmentId].accepted = true;
        bounties[_bountyId].status = BountyStatus.ACCEPTED;
        fulfilments[_bountyId][_fulfilmentId].fulfiler.transfer(bounties[_bountyId].amount);
        emit FulfilmentAccepted(_bountyId, bounties[_bountyId].issuer, fulfilments[_bountyId][_fulfilmentId].fulfiler, _fulfilmentId, bounties[_bountyId].amount);
    }

    /**
     * @dev cancelBounty(): cancels a bounty and returns the funds to the issuer
     * @param _bountyId the id of the bounty to cancel
     */
    function cancelBounty(
        uint _bountyId
    )

    public bountyExists(_bountyId) onlyIssuer(_bountyId) hasStatus(_bountyId, BountyStatus.CREATED)
    {
        bounties[_bountyId].status = BountyStatus.CANCELLED;
        bounties[_bountyId].issuer.transfer(bounties[_bountyId].amount);
        emit BountyCancelled(_bountyId, msg.sender, bounties[_bountyId].amount);
    }

    /**
     * @dev toBytes(): Converts an address to bytes for logging.
     * @param a the address to Converts
     * @return the address in bytes
     */
    function toBytes(address a) private pure returns (bytes memory) {
        return abi.encode(a);
    }

    /**
     * @dev bytesToBytes32(): Converts bytes to bytes32 for logging.
     * @param b the bytes to convert
     * @param offset Offset to start the conversion at. 0 if you require the whole number.
     */
    function bytesToBytes32(bytes memory b, uint offset) private pure returns (bytes32) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
        }
        return out;
    }

    /**
     * @dev bytesToBytes32(): Converts bytes to bytes32 for logging.
     * @param b the bytes to convert
     */
    function bytesToBytes32(bytes memory b) private pure returns (bytes32) {
        return bytesToBytes32(b, 0);
    }

    /**
     * Modifiers
     */
    modifier validateDeadline(uint _newDeadline) {
        require(_newDeadline > now);
        _;
    }

    modifier hasValue() {
        require(msg.value > 0);
        _;
    }

    modifier bountyExists(uint _bountyId) {
        require(_bountyId < bounties.length);
        _;
    }

    modifier notIssuer(uint _bountyId) {
        log0(bytesToBytes32(toBytes(msg.sender)));
        log0(bytesToBytes32(toBytes(bounties[_bountyId].issuer)));
        require(msg.sender != bounties[_bountyId].issuer);
        _;
    }

    modifier hasStatus(uint _bountyId, BountyStatus _requiredStatus) {
        log0(bytes32(_bountyId));
        require(_requiredStatus == bounties[_bountyId].status);
        _;
    }

    modifier isBeforeDeadline(uint _bountyId) {
        require(now < bounties[_bountyId].deadline);
        _;
    }

    modifier fulfilmentExists(uint _bountyId, uint _fulfilmentId) {
        require(_fulfilmentId < fulfilments[_bountyId].length);
        _;
    }

    modifier onlyIssuer(uint _bountyId) {
        require(msg.sender == bounties[_bountyId].issuer);
        _;
    }

    modifier fulfilmentNotYetAccepted(uint _bountyId, uint _fulfilmentId) {
        require(fulfilments[_bountyId][_fulfilmentId].accepted == false);
        _;
    }

    /**
     * Events
     */
    event BountyIssued(uint bountyId, address issuer, uint amount, string data);
    event BountyFulfiled(uint bountyId, address fulfiler, uint fulfilmentId, string data);
    event FulfilmentAccepted(uint bountyId, address issuer, address fulfiler, uint indexed fulfilmentId, uint amount);
    event BountyCancelled(uint indexed bountyId, address indexed sender, uint amount);
}
