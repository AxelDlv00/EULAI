- In TOSDR, (e.g. https://tosdr.org/en/service/182), when we click on a point there is a further explanation of the point. I think we did not retrieve this explanation in our dataset. It could be interesting to add it as additional context for the model.
- We want to train a bert model to find the critical points in the TOS. For that, we should either use a good embedding model to compute similarity between the TOS paragraphs and the TOSDR points, or use a LLM API to find the paragraphs to use. 

- Maybe : 
    - Select ~500 texts of TOS 
    - ask a LLM (e.g. GPT-4o-mini) to find the most relevant paragraphs (by rewriting only them exactly as in the TOS for instance)
    - if this LLM modified slightly the text, we can use embedding similarity to find the exact paragraph in the TOS.
    - Train the bert model on this dataset. 
    - Our BERT model can now highlight the critical paragraphs in a TOS.

- Given a paragraph, we want to extract the critical points, and also classify their risk level (e.g. red/orange/green), and give a short title, a summary and the reason for the risk level. This could be done with a LLM API, or we could also extract some from the TOSDR dataset, however we cannot access the original paragraph... 
    - After training another bert model to classify the risk level of a paragraph, and then use a SLM to generate the title, summary and reason, we should have what we want.