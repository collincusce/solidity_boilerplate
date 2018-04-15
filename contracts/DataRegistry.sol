pragma solidity 0.4.21;

contract DataRegistry {

	enum Categories {Fingerprint, Faceshot, MissingPerson, CriminalRecord, TrafficAlert, Uncategorized}
	struct DataNode {
		uint creationts;
		uint reportts;
		uint ipfs;
		address reporter;
		Categories category;
		string mimetype;
	}

	uint[] ipfs_lookup;
	mapping(uint => DataNode) ipfs_nodes;
	
	//https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in/
	function addData(uint _ipfs, uint _creationts, Categories _category, string _mimetype) public {
		DataNode memory dn = DataNode({creationts:_creationts, reportts:now, ipfs:_ipfs, reporter:msg.sender, category: _category, mimetype:_mimetype});
		ipfs_lookup.push(_ipfs);
		ipfs_nodes[_ipfs] = dn;
	}
	//returns ipfs, creationts, reportts, reporter, category
	function getData (uint idx) public view returns(uint, uint, uint, address, Categories, string) {
		DataNode memory _dn = ipfs_nodes[ipfs_lookup[idx]];
		return (ipfs_lookup[idx], _dn.creationts, _dn.reportts, _dn.reporter, _dn.category, _dn.mimetype);
	}

}