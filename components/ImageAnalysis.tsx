'use client';

import React, { useState, useEffect } from 'react';

interface ImageAnalysisProps {
  analysis: string;
  itemId: number;
  onSelectionChange: (itemId: number, selectedRows: string[]) => void;
}

const ImageAnalysis = ({ analysis, itemId, onSelectionChange }: ImageAnalysisProps) => {
  const [tableData, setTableData] = useState<Array<{
    riskFactor: string;
    severity: string;
    probability: string;
    riskLevel: string;
    countermeasure: string;
    isSelected: boolean;
  }>>([]);
  
  // 전체 선택 상태 추가
  const [selectAll, setSelectAll] = useState(false);
  
  // 분석 결과가 변경될 때마다 테이블 데이터 추출
  useEffect(() => {
    if (!analysis) return;
    
    try {
      // HTML 파싱을 위한 임시 요소 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = analysis;
      
      // 테이블 찾기
      const table = tempDiv.querySelector('table');
      if (!table) return;
      
      // tbody 내의 모든 행에서 데이터 추출
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      
      const rows = tbody.querySelectorAll('tr');
      const extractedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        
        // 각 셀에서 텍스트 추출
        return {
          riskFactor: cells[0]?.textContent?.trim() || '',
          severity: cells[1]?.textContent?.trim() || '',
          probability: cells[2]?.textContent?.trim() || '',
          riskLevel: cells[3]?.textContent?.trim() || '',
          countermeasure: cells[4]?.textContent?.trim() || '',
          isSelected: false
        };
      });
      
      setTableData(extractedData);
      setSelectAll(false); // 새 데이터가 로드될 때 전체 선택 상태 초기화
    } catch (error) {
      console.error('테이블 데이터 추출 오류:', error);
    }
  }, [analysis]);
  
  // 체크박스 변경 처리
  const handleCheckboxChange = (index: number) => {
    setTableData(prevData => {
      const newData = [...prevData];
      newData[index] = {
        ...newData[index],
        isSelected: !newData[index].isSelected
      };
      
      // 모든 항목이 선택되었는지 확인하여 전체 선택 상태 업데이트
      const allSelected = newData.every(item => item.isSelected);
      setSelectAll(allSelected);
      
      return newData;
    });
  };
  
  // 전체 선택/해제 처리
  const handleSelectAllChange = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    // 모든 행의 선택 상태 업데이트
    setTableData(prevData => 
      prevData.map(row => ({
        ...row,
        isSelected: newSelectAll
      }))
    );
  };
  
  // 선택된 행이 변경될 때마다 부모 컴포넌트에 알림
  useEffect(() => {
    const selectedRows = tableData
      .filter(row => row.isSelected)
      .map(row => `${row.riskFactor}|${row.severity}|${row.probability}|${row.riskLevel}|${row.countermeasure}`);
    
    onSelectionChange(itemId, selectedRows);
  }, [tableData, itemId, onSelectionChange]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md h-full">
      <h2 className="text-xl font-semibold mb-4">위험성평가표</h2>
      
      {tableData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAllChange}
                    className="w-5 h-5 cursor-pointer"
                  />
                </th>
                <th>위험 요소</th>
                <th>중대성</th>
                <th>가능성</th>
                <th>위험도</th>
                <th>대책</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.isSelected}
                      onChange={() => handleCheckboxChange(index)}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </td>
                  <td>{row.riskFactor}</td>
                  <td>{row.severity}</td>
                  <td>{row.probability}</td>
                  <td>{row.riskLevel}</td>
                  <td>{row.countermeasure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div 
          className="text-gray-700"
          dangerouslySetInnerHTML={{ __html: analysis }}
        />
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        {tableData.filter(row => row.isSelected).length > 0 ? (
          <p>{tableData.filter(row => row.isSelected).length}개 항목 선택됨</p>
        ) : (
          <p>체크박스를 선택하여 위험 요소를 모을 수 있습니다.</p>
        )}
      </div>
      
      <style jsx global>{`
        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1rem;
          border: 1px solid #e2e8f0;
          font-size: 0.95rem;
        }
        
        th, td {
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          vertical-align: top;
        }
        
        th {
          background-color: #f1f5f9;
          font-weight: 600;
          text-align: left;
          color: #334155;
        }
        
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        tr:hover {
          background-color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default ImageAnalysis; 