pragma solidity 0.4.21;

contract DataRegistry {

	enum Categories {Fingerprint, Faceshot, MissingPerson, CriminalRecord, TrafficAlert, Uncategorized}
	struct DataNode {
		uint creationts;
		uint reportts;
		uint ipfs;
		address reporter;
		Categories category;
		bool complete;
		string mimetype;
	}
	uint data_count = 0;
	uint completed_count = 0;
	uint[] ipfs_lookup;
	uint[] ipfs_complete;
	mapping(uint => DataNode) ipfs_nodes;
	
	//https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in/
	function addData(uint _ipfs, uint _creationts, Categories _category, string _mimetype) public returns(uint) {

		require (ipfs_nodes[_ipfs].reportts == 0);
		
		DataNode memory dn = DataNode({creationts:_creationts, reportts:now, ipfs:_ipfs, reporter:msg.sender, category: _category, complete: false, mimetype:_mimetype});
		ipfs_lookup.push(_ipfs);
		ipfs_nodes[_ipfs] = dn;
		data_count++;
		return data_count;
	}

	function markComplete(uint _ipfsx) public {
		ipfs_complete.push(_ipfsx);
		ipfs_nodes[_ipfsx].complete = true;
		completed_count++;
	}

	//returns ipfs, creationts, reportts, reporter, complete, category
	function getData (uint idx) public view returns(uint, uint, uint, address, Categories, bool, string) {
		DataNode memory _dn = ipfs_nodes[ipfs_lookup[idx]];
		return (ipfs_lookup[idx], _dn.creationts, _dn.reportts, _dn.reporter, _dn.category, _dn.complete, _dn.mimetype);
	}

	function getTop () public view returns(uint){
		return data_count;
	}

	function getCompletedCount() public view returns(uint) {
		return completed_count;
	}

}