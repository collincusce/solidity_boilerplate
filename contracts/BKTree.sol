pragma solidity 0.4.21;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
//import "https://github.com/OpenZeppelin/zeppelin-solidity/contracts/math/SafeMath.sol";

contract BKTree {
	
	using SafeMath for uint;
	
	uint private _threshold;
	Node private _root;

	struct Node {
		uint value;
		bytes32 ipfs; 
		bool completed;
		uint[] children_distances;
		mapping (uint => Node) children;
	}
	
	//https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in/
	function BKTree(uint root, bytes32 data, uint threshold) public {
		_threshold = threshold;
		uint[] memory tmp;
		_root = Node({value:root, ipfs:data, completed:false, children_distances:tmp});
	}

	function addNode(uint id, uint dist, bytes32 data, uint[] _path) public {
		uint[] memory tmp;
		Node memory newNode = Node({value:id, ipfs:data, completed:false, children_distances:tmp});
		Node storage curNode = _root;
		for(uint i = 0x1; i < _path.length; i = i.add(1)){
			curNode = curNode.children[_path[i]];
		}
		require(curNode.children[dist].ipfs == 0x0);
		curNode.children_distances.push(dist);
		curNode.children[dist] = newNode;
	}

	function markCompleted(uint id, uint[] path) public {
		Node storage curNode = _root;
		for(uint i = 0x0; i < path.length; i = i.add(1)){
			curNode = curNode.children[path[i]];
		}
		require(curNode.value == id);
		curNode.completed = true;
	}
	//returns: path, pathlen, dist
	function findPath(uint[1] memory id) public view returns(uint[512] memory, uint[1] memory, uint[1] memory) {
	    uint[512] memory path;
	    uint[1] memory pathlen;
	    pathlen[0] = 0x0;
	    return _traverseAddPath(id, pathlen, path, _root);
	}
	//returns candidateCount and candidates
	function searchNode(uint[1] memory id) public view returns (uint[1] memory, bytes32[512] memory) {
		bytes32[512] memory candidates;
		uint[1] memory candidateCount;
		candidateCount[0] = 0;
		_getPathCandidates(id, candidateCount, candidates, _root);
		return (candidateCount, candidates);
	}

	function _getPathCandidates(uint[1] memory id, uint[1] memory candidateCount, bytes32[512] memory candidates, Node storage node) private view {
		uint[1] memory hamdist;
		hamdist[0] = _hammingDistance(node.value, id[0]);
		if(hamdist[0] <= _threshold) {
			candidates[candidateCount[0]] = node.ipfs;
			candidateCount[0] = candidateCount[0].add(1);
		}

		uint[1] memory mindist;
	    mindist[0] = hamdist[0].sub(_threshold);
	    mindist[0] = mindist[0] >= 0 ? mindist[0] : 0;
	    
	    uint[1] memory maxdist;
	    maxdist[0] = hamdist[0].add(_threshold);
	    uint[1] memory i;
		for(i[0] = 0; i[0] < node.children_distances.length; i[0] = i[0].add(1)){
			if(node.children_distances[i[0]] >= mindist[0] && node.children_distances[i[0]] <= maxdist[0]){
				_getPathCandidates(id, candidateCount, candidates, node.children[node.children_distances[i[0]]]);
			}
		}
	}

	function _traverseAddPath(uint[1] memory id, uint[1] memory pathlen, uint[512] memory path, Node storage node) internal view returns (uint[512] memory, uint[1] memory, uint[1] memory) {
	    uint[1] memory hamdist;
		hamdist[0] = _hammingDistance(node.value, id[0]);
		pathlen[0] = pathlen[0].add(1);
		path[pathlen[0]] = hamdist[0];
		if(node.children[hamdist[0]].value != 0) { //assuming no zero-value, needs updating, but unlikely edge-case
			return _traverseAddPath(id, pathlen, path, node.children[hamdist[0]]);
		} else {
			return (path, pathlen, hamdist);
		}
	}

	function _hammingDistance(uint x, uint y) internal pure returns (uint) {
		uint dist = 0x0;
		uint val = x ^ y;
		while(val != 0x0) {
			dist = dist.add(1);
			val = val & (val.sub(1));
		}
		return dist;
	}

	/*
	function _rshift(uint aInt, uint n) internal returns (uint) {
		return aInt.mul(2 ** n);
	}

	function _lshift(uint aInt, uint n) internal returns (uint) {
		return aInt.div(2 ** n);
	}
	*/
}
